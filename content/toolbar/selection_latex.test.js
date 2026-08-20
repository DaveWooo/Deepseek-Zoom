// @vitest-environment jsdom

import { describe, expect, it, beforeEach } from 'vitest';

function loadModule() {
    const fs = require('node:fs');
    const path = require('node:path');
    const source = fs.readFileSync(path.join(__dirname, 'selection_latex.js'), 'utf8');
    // Execute the IIFE in the jsdom window context.
    const fn = new Function('window', 'document', 'Node', 'DOMParser', 'XMLSerializer', source);
    fn(window, window.document, window.Node, window.DOMParser, window.XMLSerializer);
    return window.GeminiSelectionLatex;
}

describe('GeminiSelectionLatex', () => {
    let latex;

    beforeEach(() => {
        latex = loadModule();
    });

    describe('KaTeX extraction', () => {
        it('extracts LaTeX from a KaTeX mathml annotation', () => {
            const html = `
                <span class="katex"><span class="katex-mathml">
                    <math><semantics>
                        <mrow><mi>x</mi></mrow>
                        <annotation encoding="application/x-tex">x^2 + 1</annotation>
                    </semantics></math>
                </span><span class="katex-html">…</span></span>
            `;
            expect(latex.toLatexText(html).trim()).toBe('x^2 + 1');
        });

        it('wraps display KaTeX in double dollars', () => {
            const html = `
                <span class="katex-display"><span class="katex"><span class="katex-mathml">
                    <math display="block"><semantics>
                        <mrow><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></mrow>
                        <annotation encoding="application/x-tex">E = mc^2</annotation>
                    </semantics></math>
                </span><span class="katex-html">…</span></span></span>
            `;
            expect(latex.toLatexText(html).trim()).toBe('$$E = mc^2$$');
        });
    });

    describe('MathML conversion', () => {
        it('converts native MathML fractions and superscripts to LaTeX', () => {
            const html = `
                <math xmlns="http://www.w3.org/1998/Math/MathML">
                    <mrow>
                        <mfrac><mn>1</mn><mn>2</mn></mfrac>
                        <mo>+</mo>
                        <msup><mi>x</mi><mn>3</mn></msup>
                    </mrow>
                </math>
            `;
            const out = latex.toLatexText(html);
            expect(out).toContain('\\frac{1}{2}');
            expect(out).toContain('x^{3}');
            expect(out).toContain('$');
        });

        it('maps common MathML operators to LaTeX commands', () => {
            const html = `
                <math xmlns="http://www.w3.org/1998/Math/MathML">
                    <mrow><mi>a</mi><mo>≤</mo><mi>b</mi><mo>×</mo><mi>c</mi><mo>≠</mo><mi>d</mi></mrow>
                </math>
            `;
            const out = latex.toLatexText(html);
            expect(out).toContain('\\le');
            expect(out).toContain('\\times');
            expect(out).toContain('\\ne');
        });

        it('converts MathML limits, summations and integrals (munder, mover, munderover)', () => {
            const html = `
                <math>
                    <munderover>
                        <mo>∑</mo>
                        <mrow><mi>i</mi><mo>=</mo><mn>1</mn></mrow>
                        <mi>n</mi>
                    </munderover>
                    <msub><mi>x</mi><mi>i</mi></msub>
                </math>
            `;
            const out = latex.toLatexText(html);
            expect(out).toContain('\\sum');
            expect(out).toMatch(/_\{i\s*=\s*1\}\^\{n\}/);
            expect(out).toContain('x_{i}');
        });

        it('converts MathML matrices (mtable, mtr, mtd)', () => {
            const html = `
                <math>
                    <mtable>
                        <mtr><mtd><mn>1</mn></mtd><mtd><mn>0</mn></mtd></mtr>
                        <mtr><mtd><mn>0</mn></mtd><mtd><mn>1</mn></mtd></mtr>
                    </mtable>
                </math>
            `;
            const out = latex.toLatexText(html);
            expect(out).toContain('\\begin{matrix}');
            expect(out).toContain('1 & 0 \\\\ 0 & 1');
            expect(out).toContain('\\end{matrix}');
        });

        it('converts MathML brackets (mfenced) and boxed elements (menclose)', () => {
            const html = `
                <math>
                    <mfenced open="[" close="]">
                        <mrow><mi>x</mi><mo>+</mo><mi>y</mi></mrow>
                    </mfenced>
                    <menclose notation="box">
                        <mi>z</mi>
                    </menclose>
                </math>
            `;
            const out = latex.toLatexText(html);
            expect(out).toContain('\\left[');
            expect(out).toContain('\\right]');
            expect(out).toContain('\\boxed{z}');
        });

        it('converts Greek letters and calculus symbols', () => {
            const html = `
                <math>
                    <mrow>
                        <mi>α</mi><mo>+</mo><mi>β</mi><mo>=</mo><mi>θ</mi><mo>+</mo><mo>∫</mo><mi>f</mi><mo stretchy="false">(</mo><mi>x</mi><mo stretchy="false">)</mo><mo>∂</mo><mi>x</mi>
                    </mrow>
                </math>
            `;
            const out = latex.toLatexText(html);
            expect(out).toContain('\\alpha');
            expect(out).toContain('\\beta');
            expect(out).toContain('\\theta');
            expect(out).toContain('\\int');
            expect(out).toContain('\\partial');
        });

        it('converts block display math with double dollars', () => {
            const html = `
                <math display="block">
                    <mrow><mi>y</mi><mo>=</mo><mi>f</mi><mo stretchy="false">(</mo><mi>x</mi><mo stretchy="false">)</mo></mrow>
                </math>
            `;
            const out = latex.toLatexText(html);
            expect(out.startsWith('$$')).toBe(true);
            expect(out.endsWith('$$')).toBe(true);
        });
    });

    describe('MathJax and custom web math', () => {
        it('extracts LaTeX from MathJax v2 inline script tag', () => {
            const html = '<script type="math/tex">E = mc^2</script>';
            expect(latex.toLatexText(html).trim()).toBe('$E = mc^2$');
        });

        it('extracts LaTeX from MathJax v2 display script tag', () => {
            const html =
                '<script type="math/tex; mode=display">\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}</script>';
            expect(latex.toLatexText(html).trim()).toBe(
                '$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$'
            );
        });

        it('extracts LaTeX from MathJax v3 container with assistive MathML', () => {
            const html = `
                <mjx-container class="MathJax">
                    <mjx-assistive-mml>
                        <math><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow></math>
                    </mjx-assistive-mml>
                </mjx-container>
            `;
            const out = latex.toLatexText(html);
            expect(out).toMatch(/a\s*\+\s*b/);
        });

        it('extracts LaTeX from Zhihu math span with data-tex', () => {
            const html =
                '<span class="ztext-math" data-tex="\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}"></span>';
            expect(latex.toLatexText(html).trim()).toBe(
                '$\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}$'
            );
        });

        it('extracts and cleans Wikipedia math elements with {\\displaystyle ...}', () => {
            const html = `
                <span class="mwe-math-element">
                    <img class="mwe-math-fallback-image-inline" alt="{\\displaystyle \\int_0^1 x^2 dx = \\frac{1}{3}}" src="formula.svg" />
                </span>
            `;
            expect(latex.toLatexText(html).trim()).toBe('\\int_0^1 x^2 dx = \\frac{1}{3}');
        });

        it('extracts LaTeX from generic elements with data-latex or data-formula', () => {
            const html = '<div data-latex="\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1"></div>';
            expect(latex.toLatexText(html).trim()).toBe('\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1');
        });
    });

    describe('Image formula extraction', () => {
        it('uses the alt text of image formulas', () => {
            const html = '<img alt="\\frac{1}{2}" src="formula.png" />';
            expect(latex.toLatexText(html).trim()).toBe('\\frac{1}{2}');
        });

        it('extracts LaTeX from data-latex and data-tex image attributes', () => {
            const html =
                '<img data-latex="\\sum_{k=1}^n k = \\frac{n(n+1)}{2}" src="formula.png" />';
            expect(latex.toLatexText(html).trim()).toBe('\\sum_{k=1}^n k = \\frac{n(n+1)}{2}');
        });

        it('extracts LaTeX from image title or aria-label', () => {
            const html =
                '<img title="f\'(x) = \\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}" src="derivative.png" />';
            expect(latex.toLatexText(html).trim()).toBe(
                "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}"
            );
        });

        it('decodes LaTeX from CodeCogs image URL', () => {
            const html =
                '<img src="https://latex.codecogs.com/svg.latex?%5Cfrac%7B1%7D%7B2%7D%20%2B%20%5Csqrt%7Bx%7D" />';
            expect(latex.toLatexText(html).trim()).toBe('\\frac{1}{2} + \\sqrt{x}');
        });

        it('decodes LaTeX from Google Charts formula URL', () => {
            const html =
                '<img src="https://chart.googleapis.com/chart?cht=tx&chl=E%20%3D%20mc%5E2" />';
            expect(latex.toLatexText(html).trim()).toBe('E = mc^2');
        });

        it('decodes LaTeX from SVG data URI containing desc/title', () => {
            const svgContent = encodeURIComponent(
                '<svg><desc>\\alpha^2 + \\beta^2 = 1</desc></svg>'
            );
            const html = `<img src="data:image/svg+xml,${svgContent}" />`;
            expect(latex.toLatexText(html).trim()).toBe('\\alpha^2 + \\beta^2 = 1');
        });

        it('extracts LaTeX from SVG elements with data-latex or desc', () => {
            const html =
                '<svg data-latex="\\mathbf{F} = m\\mathbf{a}"><desc>\\mathbf{F} = m\\mathbf{a}</desc></svg>';
            expect(latex.toLatexText(html).trim()).toBe('\\mathbf{F} = m\\mathbf{a}');
        });

        it('extracts LaTeX from WIRIS MathML with special bracket quotes', () => {
            const html =
                '<p>集合 <img class="Wirisformula" data-mathml="«math xmlns=¨http://www.w3.org/1998/Math/MathML¨»«mi»A«/mi»«mo»=«/mo»«mo»{«/mo»«mi»x«/mi»«mo»∈«/mo»«mi»R«/mi»«mo»|«/mo»«mo»|«/mo»«mi»x«/mi»«mo»-«/mo»«mn»2«/mn»«mo»|«/mo»«mo»≤«/mo»«mn»5«/mn»«mo»}«/mo»«/math»" src="formula.png" /> 中最小整数位<span class="underline">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>.</p>';
            const out = latex.toLatexText(html);
            expect(out).toContain('集合');
            expect(out).toContain('A');
            expect(out).toContain('\\in');
            expect(out).toContain('R');
            expect(out).toContain('\\le');
            expect(out).toContain('中最小整数位');
            expect(out).toContain('______');
            expect(out).not.toContain('[formula]');
        });

        it('extracts LaTeX from MathType entity-encoded data-mathml', () => {
            const html =
                '<img class="MathType" data-mathml="&lt;math&gt;&lt;mi&gt;A&lt;/mi&gt;&lt;mo&gt;=&lt;/mo&gt;&lt;mo&gt;{&lt;/mo&gt;&lt;mi&gt;x&lt;/mi&gt;&lt;mo&gt;&amp;isin;&lt;/mo&gt;&lt;mi&gt;R&lt;/mi&gt;&lt;mo&gt;|&lt;/mo&gt;&lt;mo&gt;|&lt;/mo&gt;&lt;mi&gt;x&lt;/mi&gt;&lt;mo&gt;-&lt;/mo&gt;&lt;mn&gt;2&lt;/mn&gt;&lt;mo&gt;|&lt;/mo&gt;&lt;mo&gt;&amp;le;&lt;/mo&gt;&lt;mn&gt;5&lt;/mn&gt;&lt;mo&gt;}&lt;/mo&gt;&lt;/math&gt;" src="formula.png" />';
            const out = latex.toLatexText(html);
            expect(out).toContain('A');
            expect(out).toContain('\\in');
            expect(out).toContain('\\le');
            expect(out).not.toContain('[formula]');
        });

        it('extracts LaTeX from question bank container wrappers (.q-math, .MathType)', () => {
            const html =
                '<p>集合 <span class="q-math" data-latex="A = \\{ x \\in R \\mid |x - 2| \\le 5 \\}"><img src="formula.png" /></span> 中最小整数位______.</p>';
            const out = latex.toLatexText(html);
            expect(out).toContain('集合');
            expect(out).toContain('A = \\{ x \\in R \\mid |x - 2| \\le 5 \\}');
            expect(out).toContain('中最小整数位');
            expect(out).not.toContain('[formula]');
        });

        it('extracts LaTeX from URL query parameters (?formula=, ?tex=, ?eq=)', () => {
            const html =
                '<img src="https://example.com/math/render?formula=A%3D%7Bx%5Cin%20R%7C%7Cx-2%7C%5Cle%205%7D" />';
            const out = latex.toLatexText(html);
            expect(out).toContain('\\in');
            expect(out).toContain('\\le');
            expect(out).not.toContain('[formula]');
        });

        it('resolves image formulas via formulaCache when pre-recognized or OCR-cached', () => {
            const imgUrl =
                'https://tikuimgs.oss-cn-qingdao.aliyuncs.com/tikuimg/q_500004/e/12/09/07/759d16aaaeaa.gif';
            latex.cacheFormula(imgUrl, '$A = \\{ x \\in R \\mid |x - 2| \\le 5 \\}$');

            const html = `
                <section class="card-text mb-3">
                    集合<img width="'141'" height="'29'" border="0" src="${imgUrl}">中最小整数位<u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.</u>
                </section>
            `;
            const out = latex.toLatexText(html);
            expect(out).toContain('集合');
            expect(out).toContain('$A = \\{ x \\in R \\mid |x - 2| \\le 5 \\}$');
            expect(out).toContain('中最小整数位');
            expect(out).toContain('______ .');
            expect(out).not.toContain('[formula]');

            latex.clearFormulaCache();
        });

        it('preserves markdown image link for uncached web formula images', () => {
            const html =
                '<section class="card-text">集合<img src="https://tikuimgs.oss-cn-qingdao.aliyuncs.com/tikuimg/q_500004/e/12/09/07/759d16aaaeaa.gif">中最小整数位</section>';
            const out = latex.toLatexText(html);
            expect(out).toContain(
                '![formula](https://tikuimgs.oss-cn-qingdao.aliyuncs.com/tikuimg/q_500004/e/12/09/07/759d16aaaeaa.gif)'
            );
        });

        it('marks image formulas without alt text as [formula]', () => {
            const html = '<img src="formula.png" />';
            expect(latex.toLatexText(html).trim()).toBe('[formula]');
        });
    });

    describe('Rich DOM structural elements', () => {
        it('keeps plain text selections intact', () => {
            const html = 'Hello <b>world</b>, this is <i>plain</i> text.';
            const out = latex.toLatexText(html);
            expect(out).toContain('Hello world, this is plain text.');
        });

        it('converts tables to LaTeX tabular format', () => {
            const html = `
                <table>
                    <tr><th>Header 1</th><th>Header 2</th></tr>
                    <tr><td>Val 1</td><td>Val 2</td></tr>
                </table>
            `;
            const out = latex.toLatexText(html);
            expect(out).toContain('\\begin{tabular}');
            expect(out).toContain('Header 1 & Header 2');
            expect(out).toContain('Val 1 & Val 2');
            expect(out).toContain('\\end{tabular}');
        });

        it('converts unordered and ordered lists to LaTeX itemize / enumerate', () => {
            const html = `
                <ul>
                    <li>First point</li>
                    <li>Second point</li>
                </ul>
            `;
            const out = latex.toLatexText(html);
            expect(out).toContain('\\begin{itemize}');
            expect(out).toContain('\\item First point');
            expect(out).toContain('\\item Second point');
            expect(out).toContain('\\end{itemize}');
        });

        it('converts headings and blockquotes to LaTeX sections and quotes', () => {
            const html = `
                <h1>Introduction</h1>
                <blockquote>This is a blockquote.</blockquote>
            `;
            const out = latex.toLatexText(html);
            expect(out).toContain('\\section{Introduction}');
            expect(out).toContain('\\begin{quote}');
            expect(out).toContain('This is a blockquote.');
            expect(out).toContain('\\end{quote}');
        });

        it('converts pre and code tags to verbatim / texttt', () => {
            const html = '<pre>console.log("hello");</pre> and <code>let x = 1;</code>';
            const out = latex.toLatexText(html);
            expect(out).toContain('\\begin{verbatim}');
            expect(out).toContain('console.log("hello");');
            expect(out).toContain('\\end{verbatim}');
            expect(out).toContain('\\texttt{let x = 1;}');
        });

        it('produces non-empty output from empty input only as empty string', () => {
            expect(latex.toLatexText('')).toBe('');
            expect(latex.toLatexText('<p></p>')).toBe('');
        });
    });

    describe('getSelectionLatexText integration', () => {
        it('extracts selection HTML from window.getSelection and converts it', () => {
            const div = document.createElement('div');
            div.innerHTML =
                '<span class="katex"><span class="katex-mathml"><math><annotation encoding="application/x-tex">a^2+b^2=c^2</annotation></math></span></span>';
            document.body.appendChild(div);

            const range = document.createRange();
            range.selectNodeContents(div);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);

            const text = latex.getSelectionLatexText();
            expect(text.trim()).toBe('a^2+b^2=c^2');

            document.body.removeChild(div);
        });
    });
});
