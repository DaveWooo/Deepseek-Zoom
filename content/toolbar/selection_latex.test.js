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
                <mrow><mi>a</mi><mo>≤</mo><mi>b</mi></mrow>
            </math>
        `;
        const out = latex.toLatexText(html);
        expect(out).toContain('\\le');
    });

    it('uses the alt text of image formulas', () => {
        const html = '<img alt="\\frac{1}{2}" src="formula.png" />';
        expect(latex.toLatexText(html).trim()).toBe('\\frac{1}{2}');
    });

    it('marks image formulas without alt text', () => {
        const html = '<img src="formula.png" />';
        expect(latex.toLatexText(html).trim()).toBe('[formula]');
    });

    it('keeps plain text selections intact', () => {
        const html = 'Hello <b>world</b>, this is <i>plain</i> text.';
        const out = latex.toLatexText(html);
        expect(out).toContain('Hello world, this is plain text.');
    });

    it('produces non-empty output from empty input only as empty string', () => {
        expect(latex.toLatexText('')).toBe('');
        expect(latex.toLatexText('<p></p>')).toBe('');
    });
});
