(function () {
    /**
     * Convert a text-selection HTML fragment into LaTeX-friendly plain text.
     *
     * Web math is usually rendered as MathML, KaTeX, MathJax, or formula images.
     * Plain textContent of such selections is math noise (or empty for image
     * formulas), which cannot be copied or shown in the plain-text ask input.
     *
     * This helper:
     *   1. prefers the original LaTeX carried in annotations (KaTeX, MathML, MathJax, Zhihu, Wikipedia)
     *   2. extracts LaTeX formulas from images (alt, data-mathml, data-wiris-mathml, data-latex, data-formula, CodeCogs/Google Charts/URL params, SVG)
     *   3. converts structured MathML (fractions, roots, superscripts/subscripts, matrices, limits, brackets, operators)
     *   4. handles rich structural text (tables, lists, headings, quotes, code blocks, underlines)
     */

    // MathML identifier → LaTeX mapping for Greek letters and functions.
    const GREEK_LATEX = {
        α: '\\alpha ',
        β: '\\beta ',
        γ: '\\gamma ',
        δ: '\\delta ',
        ε: '\\varepsilon ',
        ϵ: '\\epsilon ',
        ζ: '\\zeta ',
        η: '\\eta ',
        θ: '\\theta ',
        ϑ: '\\vartheta ',
        ι: '\\iota ',
        κ: '\\kappa ',
        λ: '\\lambda ',
        μ: '\\mu ',
        ν: '\\nu ',
        ξ: '\\xi ',
        π: '\\pi ',
        ϖ: '\\varpi ',
        ρ: '\\rho ',
        ϱ: '\\varrho ',
        σ: '\\sigma ',
        ς: '\\varsigma ',
        τ: '\\tau ',
        υ: '\\upsilon ',
        φ: '\\varphi ',
        ϕ: '\\phi ',
        χ: '\\chi ',
        ψ: '\\psi ',
        ω: '\\omega ',
        Γ: '\\Gamma ',
        Δ: '\\Delta ',
        Θ: '\\Theta ',
        Λ: '\\Lambda ',
        Ξ: '\\Xi ',
        Π: '\\Pi ',
        Σ: '\\Sigma ',
        Υ: '\\Upsilon ',
        Φ: '\\Phi ',
        Ψ: '\\Psi ',
        Ω: '\\Omega ',
    };

    const MATH_FUNCTIONS = {
        sin: '\\sin ',
        cos: '\\cos ',
        tan: '\\tan ',
        cot: '\\cot ',
        sec: '\\sec ',
        csc: '\\csc ',
        arcsin: '\\arcsin ',
        arccos: '\\arccos ',
        arctan: '\\arctan ',
        sinh: '\\sinh ',
        cosh: '\\cosh ',
        tanh: '\\tanh ',
        ln: '\\ln ',
        log: '\\log ',
        exp: '\\exp ',
        lim: '\\lim ',
        max: '\\max ',
        min: '\\min ',
        sup: '\\sup ',
        inf: '\\inf ',
        det: '\\det ',
        gcd: '\\gcd ',
        deg: '\\deg ',
        dim: '\\dim ',
        ker: '\\ker ',
    };

    // MathML operator → LaTeX mapping for common mathematical symbols.
    const MO_LATEX = {
        ...GREEK_LATEX,
        // Arithmetic & Operations
        '×': '\\times ',
        '÷': '\\div ',
        '±': '\\pm ',
        '∓': '\\mp ',
        '−': '-',
        '·': '\\cdot ',
        '∘': '\\circ ',
        '*': '*',
        '⊗': '\\otimes ',
        '⊕': '\\oplus ',
        '⊙': '\\odot ',
        '⊘': '\\oslash ',
        '⊛': '\\circledast ',

        // Relations & Equality
        '≤': '\\le ',
        '≥': '\\ge ',
        '<': '<',
        '>': '>',
        '=': '=',
        '≠': '\\ne ',
        '≈': '\\approx ',
        '≡': '\\equiv ',
        '∼': '\\sim ',
        '≃': '\\simeq ',
        '≅': '\\cong ',
        '∝': '\\propto ',
        '≪': '\\ll ',
        '≫': '\\gg ',
        '⊥': '\\perp ',
        '∥': '\\parallel ',
        '≟': '\\stackrel{?}{=} ',

        // Sets & Logic
        '∈': '\\in ',
        '∉': '\\notin ',
        '∋': '\\ni ',
        '⊆': '\\subseteq ',
        '⊂': '\\subset ',
        '⊇': '\\supseteq ',
        '⊃': '\\supset ',
        '∪': '\\cup ',
        '∩': '\\cap ',
        '∅': '\\emptyset ',
        '∖': '\\setminus ',
        '∀': '\\forall ',
        '∃': '\\exists ',
        '∄': '\\nexists ',
        '¬': '\\neg ',
        '∧': '\\land ',
        '∨': '\\lor ',
        '⊤': '\\top ',
        '⊥': '\\bot ',
        '⊢': '\\vdash ',
        '⊨': '\\models ',

        // Brackets & Delimiters
        '{': '\\{ ',
        '}': '\\} ',
        '|': '| ',
        '‖': '\\| ',
        '⟨': '\\langle ',
        '⟩': '\\rangle ',
        '⌈': '\\lceil ',
        '⌉': '\\rceil ',
        '⌊': '\\lfloor ',
        '⌋': '\\rfloor ',

        // Calculus & Symbols
        '√': '\\sqrt{} ',
        '∞': '\\infty ',
        '∂': '\\partial ',
        '∇': '\\nabla ',
        '∫': '\\int ',
        '∬': '\\iint ',
        '∭': '\\iiint ',
        '∮': '\\oint ',
        '∑': '\\sum ',
        '∏': '\\prod ',
        '∐': '\\coprod ',
        lim: '\\lim ',
        max: '\\max ',
        min: '\\min ',
        sup: '\\sup ',
        inf: '\\inf ',

        // Arrows
        '→': '\\to ',
        '←': '\\leftarrow ',
        '⇒': '\\Rightarrow ',
        '⇐': '\\Leftarrow ',
        '⇔': '\\Leftrightarrow ',
        '↔': '\\leftrightarrow ',
        '↦': '\\mapsto ',
        '↑': '\\uparrow ',
        '↓': '\\downarrow ',
        '↗': '\\nearrow ',
        '↘': '\\searrow ',

        // Dots & Punctuation
        '…': '\\ldots ',
        '⋯': '\\cdots ',
        '⋮': '\\vdots ',
        '⋱': '\\ddots ',
    };

    const UNKNOWN_FORMULA_MARKER = '[formula]';

    // In-memory cache for recognized image formulas (e.g. from OCR or vision models)
    const formulaCache = new Map();

    function cacheFormula(url, latex) {
        if (url && latex) {
            formulaCache.set(url, latex.trim());
        }
    }

    function getCachedFormula(url) {
        return url ? formulaCache.get(url) || null : null;
    }

    function clearFormulaCache() {
        formulaCache.clear();
    }

    const MATH_ATTRS = [
        'data-mathml',
        'data-wiris-mathml',
        'data-mathml-src',
        'data-latex',
        'data-tex',
        'data-formula',
        'data-math',
        'data-equation',
        'data-mathtype',
        'data-mtef',
        'data-expr',
        'data-expression',
        'data-content',
        'data-raw',
        'data-kformula',
        'data-latex-src',
        'data-formula-src',
        'data-math-code',
        'data-custom-editor',
        'data-original-formula',
        'data-original-title',
        'data-original',
        'data-alt',
        'data-title',
        'data-label',
        'alt',
        'title',
        'aria-label',
    ];

    const URL_MATH_PARAMS = [
        'formula',
        'latex',
        'tex',
        'math',
        'eq',
        'equation',
        'mathml',
        'code',
        'm',
        'q',
        'chl',
        'expr',
        'raw',
        'kformula',
        'wiris',
        'data',
    ];

    function decodeMathMlString(raw) {
        if (!raw || typeof raw !== 'string') return null;
        let str = raw.trim();
        if (!str) return null;

        // WIRIS entity replacement: « -> <, » -> >, ¨ -> ", § -> &
        if (str.includes('«') || str.includes('»') || str.includes('¨') || str.includes('§')) {
            str = str
                .replace(/«/g, '<')
                .replace(/»/g, '>')
                .replace(/¨/g, '"')
                .replace(/§/g, '&')
                .replace(/\\/g, '');
        }

        // HTML entity decoding: &lt; -> <, &gt; -> >, &quot; -> ", &amp; -> &
        if (
            str.includes('&lt;') ||
            str.includes('&gt;') ||
            str.includes('&quot;') ||
            str.includes('&amp;')
        ) {
            str = str
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&');
        }

        if (str.includes('<math') || str.includes('<semantics') || str.includes('<mrow')) {
            try {
                if (!str.includes('<math')) {
                    str = '<math>' + str + '</math>';
                }
                const doc = new DOMParser().parseFromString(str, 'text/html');
                const mathEl = doc.querySelector('math');
                if (mathEl) {
                    const converted = convertMath(mathEl);
                    if (converted && converted !== UNKNOWN_FORMULA_MARKER) {
                        return converted;
                    }
                }
            } catch {
                // Ignore parse errors
            }
        }

        return null;
    }

    function extractFormulaFromElement(el) {
        if (!el || !el.getAttribute) return null;

        for (const attr of MATH_ATTRS) {
            const val = el.getAttribute(attr);
            if (!val) continue;

            const decodedMathMl = decodeMathMlString(val);
            if (decodedMathMl) return decodedMathMl;

            const trimmed = val.trim();
            if (trimmed && trimmed !== UNKNOWN_FORMULA_MARKER) {
                return cleanWikipediaFormula(trimmed);
            }
        }

        // Check src / data-src
        const src =
            el.getAttribute('src') ||
            el.getAttribute('data-src') ||
            el.getAttribute('data-original') ||
            el.getAttribute('data-url');
        if (src) {
            const urlLatex = extractLatexFromUrl(src);
            if (urlLatex) return urlLatex;
        }

        return null;
    }

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

        // Check if element has explicit LaTeX / TeX data attribute
        const explicitLatex = getExplicitLatex(node);
        if (explicitLatex !== null) {
            return explicitLatex;
        }

        switch (tag) {
            case 'math':
                return convertMath(node);
            case 'semantics':
            case 'mrow':
            case 'mpadded':
            case 'mstyle':
            case 'mphantom':
            case 'merror':
                return children();
            case 'mi':
                return convertIdentifier(children());
            case 'mn':
                return children();
            case 'mo':
                return convertOperator(children());
            case 'mtext':
                return '\\text{' + children().trim() + '}';
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
                return '\\sqrt{' + children().trim() + '}';
            case 'mroot': {
                const kids = [...node.children].map(convertNode);
                return '\\sqrt[' + (kids[1] || '').trim() + ']{' + (kids[0] || '').trim() + '}';
            }
            case 'munder': {
                const kids = [...node.children].map(convertNode);
                return (kids[0] || '').trim() + '_{' + (kids[1] || '').trim() + '}';
            }
            case 'mover': {
                const kids = [...node.children].map(convertNode);
                return (kids[0] || '').trim() + '^{' + (kids[1] || '').trim() + '}';
            }
            case 'munderover': {
                const kids = [...node.children].map(convertNode);
                return (
                    (kids[0] || '').trim() +
                    '_{' +
                    (kids[1] || '').trim() +
                    '}^{' +
                    (kids[2] || '').trim() +
                    '}'
                );
            }
            case 'mtable':
                return convertMtable(node);
            case 'mtr':
                return convertMtr(node);
            case 'mtd':
                return children().trim();
            case 'mfenced':
                return convertMfenced(node);
            case 'menclose':
                return '\\boxed{' + children().trim() + '}';
            case 'annotation':
            case 'annotation-xml':
                return '';
            case 'img':
                return convertImage(node);
            case 'svg':
                return convertSvg(node);
            case 'script': {
                const type = (node.getAttribute('type') || '').toLowerCase();
                if (type.includes('math/tex')) {
                    const text = (node.textContent || '').trim();
                    if (!text) return '';
                    if (type.includes('mode=display')) {
                        return '$$' + text + '$$';
                    }
                    return '$' + text + '$';
                }
                return '';
            }
            case 'style':
            case 'noscript':
                return '';
            case 'br':
                return '\n';
            case 'p':
            case 'div':
            case 'section':
                return '\n' + children() + '\n';
            case 'li':
                return '\n\\item ' + children();
            case 'ul':
                return '\n\\begin{itemize}' + children() + '\n\\end{itemize}\n';
            case 'ol':
                return '\n\\begin{enumerate}' + children() + '\n\\end{enumerate}\n';
            case 'blockquote':
                return '\n\\begin{quote}\n' + children() + '\n\\end{quote}\n';
            case 'pre':
                return '\n\\begin{verbatim}\n' + (node.textContent || '') + '\n\\end{verbatim}\n';
            case 'code':
                return '\\texttt{' + (node.textContent || '') + '}';
            case 'u': {
                const content = children().trim();
                if (!content || /^[\s\u00A0_.]*$/.test(content)) {
                    const hasDot = content.includes('.');
                    return '______' + (hasDot ? ' .' : '');
                }
                return '\\underline{' + content + '}';
            }
            case 'h1':
                return '\n\\section{' + children() + '}\n';
            case 'h2':
                return '\n\\subsection{' + children() + '}\n';
            case 'h3':
                return '\n\\subsubsection{' + children() + '}\n';
            case 'h4':
            case 'h5':
            case 'h6':
                return '\n\\paragraph{' + children() + '}\n';
            case 'table':
                return convertTable(node);
            case 'tr':
            case 'td':
            case 'th':
            case 'tbody':
            case 'thead':
                return children();
            case 'hr':
                return '\n\\hrule\n';
            default: {
                // KaTeX / MathJax / Wikipedia / Zhihu / Question Bank containers
                if (tag === 'span' || tag === 'div') {
                    const cls = node.getAttribute('class') || '';

                    // Underline / Fill-in-the-blank
                    if (
                        cls.includes('underline') ||
                        cls.includes('blank') ||
                        cls.includes('fill-blank')
                    ) {
                        const content = node.textContent.trim();
                        if (!content || /^[\s\u00A0_.]*$/.test(content)) {
                            const hasDot = content.includes('.');
                            return '______' + (hasDot ? ' .' : '');
                        }
                    }

                    // Zhihu Math: <span class="ztext-math" data-tex="...">
                    if (cls.includes('ztext-math')) {
                        const tex =
                            node.getAttribute('data-tex') || node.getAttribute('data-formula');
                        if (tex) {
                            const trimmed = tex.trim();
                            return trimmed.startsWith('$') ? trimmed : '$' + trimmed + '$';
                        }
                    }

                    // Wikipedia Math: <span class="mwe-math-element">
                    if (cls.includes('mwe-math-element')) {
                        const mathml = node.querySelector(
                            '.mwe-math-mathml-inline, .mwe-math-mathml-display'
                        );
                        if (mathml) return convertChildren(mathml);
                        const fallbackImg = node.querySelector('img');
                        if (fallbackImg) return convertImage(fallbackImg);
                    }

                    // Question Bank Math containers: .q-math, .k-math, .math-render, .MathType, .Wirisformula
                    if (
                        cls.includes('q-math') ||
                        cls.includes('k-math') ||
                        cls.includes('math-render') ||
                        cls.includes('MathType') ||
                        cls.includes('Wirisformula')
                    ) {
                        const containerFormula = extractFormulaFromElement(node);
                        if (containerFormula) return containerFormula;
                        const childImg = node.querySelector('img');
                        if (childImg) return convertImage(childImg);
                    }

                    // KaTeX containers
                    if (cls.includes('katex')) {
                        const mathml = node.querySelector('.katex-mathml');
                        if (mathml) {
                            const result = convertChildren(mathml).trim();
                            if (cls.includes('katex-display')) {
                                return result.startsWith('$$')
                                    ? result
                                    : '$$' + result.replace(/^\$|\$$/g, '') + '$$';
                            }
                            return result;
                        }
                        const label = node.getAttribute('aria-label');
                        if (label && label.trim()) return label.trim();
                        return node.textContent || '';
                    }

                    // MathJax containers
                    if (cls.includes('MathJax') || cls.includes('mjx-')) {
                        const mathml = node.querySelector(
                            '.katex-mathml, mjx-assistive-mml math, math'
                        );
                        if (mathml) return convertChildren(mathml);
                        const script = node.querySelector('script[type*="math/tex"]');
                        if (script) return convertNode(script);
                        const label =
                            node.getAttribute('aria-label') || node.getAttribute('data-mathml');
                        if (label && label.trim()) return label.trim();
                        return node.textContent || '';
                    }

                    if (cls.includes('katex-html')) return '';
                }
                return children();
            }
        }
    }

    function getExplicitLatex(el) {
        if (!el || !el.getAttribute) return null;
        const tag = el.tagName ? el.tagName.toLowerCase() : '';
        if (tag === 'img' || tag === 'svg') return null;
        if (tag === 'span' && (el.getAttribute('class') || '').includes('ztext-math')) {
            return null;
        }
        return extractFormulaFromElement(el);
    }

    function convertIdentifier(text) {
        const trimmed = text.trim();
        if (!trimmed) return '';
        if (GREEK_LATEX[trimmed] !== undefined) return GREEK_LATEX[trimmed];
        if (MATH_FUNCTIONS[trimmed] !== undefined) return MATH_FUNCTIONS[trimmed];
        return text;
    }

    function superSub(kind, node) {
        const kids = [...node.children].map(convertNode);
        if (kind === '^') return (kids[0] || '').trim() + '^{' + (kids[1] || '').trim() + '}';
        if (kind === '_') return (kids[0] || '').trim() + '_{' + (kids[1] || '').trim() + '}';
        return (
            (kids[0] || '').trim() +
            '_{' +
            (kids[1] || '').trim() +
            '}^{' +
            (kids[2] || '').trim() +
            '}'
        );
    }

    function frac(node) {
        const kids = [...node.children].map(convertNode);
        return '\\frac{' + (kids[0] || '').trim() + '}{' + (kids[1] || '').trim() + '}';
    }

    function convertOperator(text) {
        const trimmed = text.trim();
        if (!trimmed) return ' ';
        const mapped = MO_LATEX[trimmed];
        if (mapped !== undefined) return mapped;
        return text;
    }

    function convertMtable(node) {
        const rows = [...node.querySelectorAll('mtr')];
        if (!rows.length) {
            return '\\begin{matrix} ' + convertChildren(node) + ' \\end{matrix}';
        }
        const rowStrings = rows.map((row) => {
            const cells = [...row.querySelectorAll('mtd')];
            return cells.map(convertChildren).join(' & ');
        });
        return '\\begin{matrix} ' + rowStrings.join(' \\\\ ') + ' \\end{matrix}';
    }

    function convertMtr(node) {
        const cells = [...node.children].map(convertChildren);
        return cells.join(' & ');
    }

    function convertMfenced(node) {
        const open = node.getAttribute('open') || '(';
        const close = node.getAttribute('close') || ')';
        const kids = [...node.children].map(convertChildren).join(', ');
        return '\\left' + open + ' ' + kids + ' \\right' + close;
    }

    function convertTable(node) {
        const rows = [...node.querySelectorAll('tr')];
        if (!rows.length) return convertChildren(node);
        const matrix = rows.map((tr) => {
            const cells = [...tr.querySelectorAll('td, th')];
            return cells.map((cell) => convertChildren(cell).trim()).join(' & ');
        });
        const colCount = rows[0]?.querySelectorAll('td, th').length || 1;
        const colsSpec = '|' + 'c|'.repeat(colCount);
        return (
            '\n\\begin{tabular}{' +
            colsSpec +
            '}\n\\hline\n' +
            matrix.join(' \\\\\n\\hline\n') +
            ' \\\\\n\\hline\n\\end{tabular}\n'
        );
    }

    function convertMath(mathEl) {
        const display = mathEl.getAttribute('display') || mathEl.getAttribute('mode');
        const isBlock = display === 'block';

        // Prefer the original LaTeX when present (KaTeX always emits it;
        // MathML-to-LaTeX converters add it too).
        const texAnnotation = mathEl.querySelector('annotation[encoding="application/x-tex"]');
        if (texAnnotation && texAnnotation.textContent.trim()) {
            const tex = texAnnotation.textContent.trim();
            if (isBlock && !tex.startsWith('$$') && !tex.startsWith('\\begin{')) {
                return '$$' + tex + '$$';
            }
            return tex;
        }

        const texXml = mathEl.querySelector(
            'annotation-xml[encoding="application/x-tex"], annotation-xml[encoding="MathML-Presentation"]'
        );
        if (texXml && texXml.textContent.trim()) {
            const tex = texXml.textContent.trim();
            if (isBlock && !tex.startsWith('$$') && !tex.startsWith('\\begin{')) {
                return '$$' + tex + '$$';
            }
            return tex;
        }

        const body = convertChildren(mathEl);
        if (!body.trim()) return UNKNOWN_FORMULA_MARKER;
        return isBlock ? '$$' + body.trim() + '$$' : '$' + body.trim() + '$';
    }

    function cleanWikipediaFormula(latex) {
        if (!latex) return '';
        // Wikipedia math alt text often begins with {\displaystyle ...}
        return latex.replace(/^\{\\displaystyle\s*([\s\S]*)\}$/, '$1').trim();
    }

    function extractLatexFromUrl(src) {
        if (!src || typeof src !== 'string') return '';

        try {
            // CodeCogs: https://latex.codecogs.com/svg.latex?<latex> or png.image?<latex>
            if (src.includes('codecogs.com/')) {
                const match = src.match(
                    /(?:svg\.latex|png\.latex|png\.image|gif\.latex)\?(?:\\inline&space;)?([\s\S]+)$/i
                );
                if (match && match[1]) {
                    return decodeURIComponent(match[1].replace(/\+/g, ' ')).trim();
                }
            }

            // Google Charts: https://chart.googleapis.com/chart?cht=tx&chl=<latex>
            if (src.includes('chart.googleapis.com/chart') && src.includes('cht=tx')) {
                const url = new URL(src, 'http://localhost');
                const chl = url.searchParams.get('chl');
                if (chl) return decodeURIComponent(chl.replace(/\+/g, ' ')).trim();
            }

            // WordPress / MimeTeX / QuickLaTeX: .../latex.php?latex=<latex> or render.cgi?<latex>
            if (
                src.includes('latex.php?latex=') ||
                src.includes('render.cgi?') ||
                src.includes('mimetex.cgi?') ||
                src.includes('mathtex.cgi?') ||
                src.includes('equation.php?eq=')
            ) {
                const match = src.match(
                    /(?:latex\.php\?latex=|render\.cgi\?|mimetex\.cgi\?|mathtex\.cgi\?|equation\.php\?eq=)([\s\S]+?)(?:&|$)/i
                );
                if (match && match[1]) {
                    return decodeURIComponent(match[1].replace(/\+/g, ' ')).trim();
                }
            }

            // Data URI SVG with LaTeX in metadata / desc / title
            if (src.startsWith('data:image/svg+xml')) {
                const svgText = src.includes('base64,')
                    ? atob(src.split('base64,')[1])
                    : decodeURIComponent(src.split(',')[1] || '');
                if (svgText) {
                    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
                    const desc = doc.querySelector('desc, title, annotation');
                    if (desc && desc.textContent.trim()) {
                        return desc.textContent.trim();
                    }
                }
            }

            // Generic URL query param extraction
            if (src.includes('?')) {
                const queryPart = src.split('?')[1] || '';
                const params = new URLSearchParams(queryPart);
                for (const param of URL_MATH_PARAMS) {
                    const val = params.get(param);
                    if (val && val.trim()) {
                        const decoded = decodeURIComponent(val.replace(/\+/g, ' ')).trim();
                        const mathml = decodeMathMlString(decoded);
                        if (mathml) return mathml;
                        return cleanWikipediaFormula(decoded);
                    }
                }
            }
        } catch {
            // Ignore URL parse failures
        }

        return '';
    }

    function convertImage(img) {
        const src =
            img.getAttribute('src') ||
            img.getAttribute('data-src') ||
            img.getAttribute('data-original') ||
            img.getAttribute('data-url');
        if (src && formulaCache.has(src)) {
            return formulaCache.get(src);
        }

        // 1. Check the image element itself
        const selfFormula = extractFormulaFromElement(img);
        if (selfFormula) return selfFormula;

        // 2. Check parent and closest math container
        const parentContainer = img.closest?.(
            '[data-mathml], [data-wiris-mathml], [data-latex], [data-tex], [data-formula], [data-math], [data-equation], [data-mathtype], [data-expr], [data-raw], [data-kformula], .q-math, .k-math, .math-render, .MathType, .Wirisformula, .ztext-math, .mwe-math-element, .formula, .latex'
        );
        if (parentContainer && parentContainer !== img) {
            const containerFormula = extractFormulaFromElement(parentContainer);
            if (containerFormula) return containerFormula;
        }

        // 3. Check sibling script or hidden math element
        if (img.parentElement) {
            const hiddenMath = img.parentElement.querySelector(
                'script[type*="math"], annotation, .hidden-latex, .latex-source, input[type="hidden"]'
            );
            if (hiddenMath) {
                const text = (hiddenMath.textContent || hiddenMath.value || '').trim();
                if (text) {
                    const mathml = decodeMathMlString(text);
                    if (mathml) return mathml;
                    return cleanWikipediaFormula(text);
                }
            }
        }

        // 4. Return markdown image for web URLs to preserve image context for multimodal AI / markdown
        if (
            src &&
            (src.startsWith('http://') ||
                src.startsWith('https://') ||
                src.startsWith('//') ||
                src.startsWith('data:image/'))
        ) {
            return '![' + (img.getAttribute('alt') || 'formula') + '](' + src + ')';
        }

        return UNKNOWN_FORMULA_MARKER;
    }

    function convertSvg(svg) {
        const dataLatex =
            svg.getAttribute('data-latex') ||
            svg.getAttribute('data-tex') ||
            svg.getAttribute('data-formula') ||
            svg.getAttribute('data-math');
        if (dataLatex && dataLatex.trim()) {
            return cleanWikipediaFormula(dataLatex.trim());
        }

        const ariaLabel = (svg.getAttribute('aria-label') || '').trim();
        if (ariaLabel) return ariaLabel;

        const desc = svg.querySelector('desc, title, annotation');
        if (desc && desc.textContent.trim()) {
            return desc.textContent.trim();
        }

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
        let out = '';
        if (doc.head && doc.head.childNodes.length > 0) {
            out += convertChildren(doc.head);
        }
        if (doc.body && doc.body.childNodes.length > 0) {
            out += convertChildren(doc.body);
        }
        if (!out && doc.documentElement) {
            out = convertChildren(doc.documentElement);
        }
        return normalizeWhitespace(out);
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
        cacheFormula,
        getCachedFormula,
        clearFormulaCache,
    };
})();
