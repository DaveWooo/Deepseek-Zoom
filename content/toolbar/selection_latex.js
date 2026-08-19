(function () {
    /**
     * Convert a text-selection HTML fragment into LaTeX-friendly plain text.
     *
     * Web math is usually rendered as MathML, KaTeX or MathJax markup. Plain
     * textContent of such selections is math noise (or empty for image
     * formulas), which cannot be shown in the plain-text ask input. This
     * helper:
     *   1. prefers the original LaTeX carried in
     *      `<annotation encoding="application/x-tex">` (KaTeX & converted MathML)
     *   2. falls back to a light structural MathML → LaTeX conversion
     *   3. maps image formulas to their `alt` text (usually LaTeX) or a marker
     *   4. keeps the remaining text with block elements as newlines
     */

    // MathML operator → LaTeX for the most common symbols.
    const MO_LATEX = {
        '×': '\\times ',
        '÷': '\\div ',
        '±': '\\pm ',
        '−': '-',
        '≤': '\\le ',
        '≥': '\\ge ',
        '<': '<',
        '>': '>',
        '=': '=',
        '≠': '\\ne ',
        '≈': '\\approx ',
        '∈': '\\in ',
        '∉': '\\notin ',
        '⊆': '\\subseteq ',
        '⊂': '\\subset ',
        '∪': '\\cup ',
        '∩': '\\cap ',
        '√': '\\sqrt{} ',
        '∞': '\\infty ',
        π: '\\pi ',
        α: '\\alpha ',
        β: '\\beta ',
        γ: '\\gamma ',
        δ: '\\delta ',
        θ: '\\theta ',
        λ: '\\lambda ',
        μ: '\\mu ',
        σ: '\\sigma ',
        φ: '\\varphi ',
        ω: '\\omega ',
        Δ: '\\Delta ',
        '∑': '\\sum ',
        '∏': '\\prod ',
        '∫': '\\int ',
        '∂': '\\partial ',
        '→': '\\to ',
        '⇒': '\\Rightarrow ',
        '⇔': '\\Leftrightarrow ',
        '∀': '\\forall ',
        '∃': '\\exists ',
        '…': '\\ldots ',
        '·': '\\cdot ',
    };

    const UNKNOWN_FORMULA_MARKER = '[formula]';

    function convertChildren(el) {
        let out = '';
        for (const node of el.childNodes) {
            out += convertNode(node);
        }
        return out;
    }

    function convertNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const tag = node.tagName.toLowerCase();
        const children = () => convertChildren(node);
        switch (tag) {
            case 'math':
                return convertMath(node);
            case 'semantics':
                // semantics wraps the visible expression + annotations.
                return convertChildren(node);
            case 'mrow':
                return children();
            case 'mi':
            case 'mn':
                return children();
            case 'mo':
                return convertOperator(children());
            case 'mtext':
                return '\\text{' + children() + '}';
            case 'mspace':
                return ' ';
            case 'msup':
                return superSub('^', node);
            case 'msub':
                return superSub('_', node);
            case 'msubsup':
                return superSub('_^', node);
            case 'mfrac':
                return frac(node);
            case 'msqrt':
                return '\\sqrt{' + children() + '}';
            case 'mroot': {
                const kids = [...node.children].map(convertChildren);
                return '\\sqrt[' + (kids[1] || '') + ']{' + (kids[0] || '') + '}';
            }
            case 'mphantom':
                return children();
            case 'merror':
                return children();
            case 'annotation':
                // Extracted by convertMath when encoding is x-tex; otherwise skip.
                return '';
            case 'annotation-xml':
                return '';
            case 'img':
                return convertImage(node);
            case 'br':
            case 'p':
            case 'div':
            case 'section':
            case 'li':
                return '\n' + children() + '\n';
            case 'script':
            case 'style':
            case 'noscript':
                return '';
            default: {
                // KaTeX / MathJax containers render both a mathml source and
                // a visual HTML tree; only the mathml/annotation should be
                // converted, otherwise the rendered HTML duplicates the text.
                if (tag === 'span' || tag === 'div') {
                    const cls = node.getAttribute('class') || '';
                    if (cls.includes('katex') || cls.includes('MathJax') || cls.includes('mjx-')) {
                        const mathml = node.querySelector('.katex-mathml');
                        if (mathml) return convertChildren(mathml);
                        const label = node.getAttribute('aria-label');
                        if (label && label.trim()) return label.trim();
                        return node.textContent || '';
                    }
                    if (cls.includes('katex-html')) return '';
                }
                return children();
            }
        }
    }

    function superSub(kind, node) {
        const kids = [...node.children].map(convertChildren);
        if (kind === '^') return (kids[0] || '') + '^{' + (kids[1] || '') + '}';
        if (kind === '_') return (kids[0] || '') + '_{' + (kids[1] || '') + '}';
        return (kids[0] || '') + '_{' + (kids[1] || '') + '}^{' + (kids[2] || '') + '}';
    }

    function frac(node) {
        const kids = [...node.children].map(convertChildren);
        return '\\frac{' + (kids[0] || '') + '}{' + (kids[1] || '') + '}';
    }

    function convertOperator(text) {
        const trimmed = text.trim();
        if (!trimmed) return ' ';
        const mapped = MO_LATEX[trimmed];
        if (mapped !== undefined) return mapped;
        return text;
    }

    function convertMath(mathEl) {
        // Prefer the original LaTeX when present (KaTeX always emits it;
        // MathML-to-LaTeX converters add it too).
        const texAnnotation = mathEl.querySelector('annotation[encoding="application/x-tex"]');
        if (texAnnotation && texAnnotation.textContent.trim()) {
            return texAnnotation.textContent.trim();
        }
        const texXml = mathEl.querySelector(
            'annotation-xml[encoding="application/x-tex"], annotation-xml[encoding="MathML-Presentation"]'
        );
        if (texXml && texXml.textContent.trim()) {
            return texXml.textContent.trim();
        }

        const body = convertChildren(mathEl);
        return body.trim() ? '$' + body.trim() + '$' : UNKNOWN_FORMULA_MARKER;
    }

    function convertImage(img) {
        const alt = (img.getAttribute('alt') || '').trim();
        if (alt) return alt;
        return UNKNOWN_FORMULA_MARKER;
    }

    function normalizeWhitespace(text) {
        // Collapse multiple blank lines, keep single newlines between blocks.
        return text
            .replace(/\r\n/g, '\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    /**
     * Convert a selection HTML fragment to LaTeX-friendly text.
     * @param {string} html
     * @returns {string}
     */
    function toLatexText(html) {
        if (!html) return '';
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const body = doc.body || doc.documentElement;
        return normalizeWhitespace(convertChildren(body));
    }

    /**
     * Extract the selection HTML from the current window selection (if any).
     * @returns {string} serialized HTML fragment or ''
     */
    function getSelectionHtml() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return '';
        try {
            const range = selection.getRangeAt(0);
            const fragment = range.cloneContents();
            return new XMLSerializer().serializeToString(fragment);
        } catch {
            return '';
        }
    }

    /**
     * Best-effort LaTeX text for the current selection. Falls back to the
     * plain selection text when no HTML could be extracted.
     * @returns {string}
     */
    function getSelectionLatexText() {
        const html = getSelectionHtml();
        const converted = html ? toLatexText(html) : '';
        const plain = window.getSelection()?.toString().trim() || '';
        // If the conversion produced nothing useful, keep the plain text so a
        // normal text selection is never lost.
        return converted || plain;
    }

    window.GeminiSelectionLatex = {
        toLatexText,
        getSelectionHtml,
        getSelectionLatexText,
    };
})();
