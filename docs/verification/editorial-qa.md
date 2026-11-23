# Editorial and interface QA

Reviewed `app/site.tsx` and `app/globals.css` on 23 November 2026. This is a source review; root is doing browser checks. No application or profile files were changed.

## Actionable items

1. **Give the figure dialog an accessible name** (`app/site.tsx:18`). The visible title is a plain span and the dialog has neither `aria-labelledby` nor `aria-label`. Give that title an ID and reference it with `aria-labelledby`. Native `showModal()` already provides modal behavior; retain its keyboard handling. [W3C dialog guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) specifies a visible-title reference or label.

2. **Keep the mobile dialog’s inner height within its outer height** (`app/globals.css:55–58`, plus the earlier mobile `.figure-dialog` rule). At widths up to 600px, the outer dialog has `max-height:calc(100dvh - 32px)` while the inner grid is `height:calc(100dvh - 22px)`. With outer `overflow:hidden`, approximately 10px plus borders can be clipped. Use one consistent available-height calculation. Check a long caption and the source/license links at 390px and with larger browser text.

3. **Check full-size figure panning from the top-left corner** (`app/globals.css:56–57` and the original `.dialog-image` rule). The scrollable container remains a centered flexbox when its image becomes larger than the viewport. Oversized centered content can begin beyond the reachable scroll origin. In full-size mode, use a block container, or start alignment with a non-shrinking image. Verify both axes with the widest and tallest original figures; do not resample their source assets.

4. **Darken the small SICSS label in light mode** (`app/globals.css:148–150`). `.sicss-name` uses `--muted` (`#69756c`) on the new quiet-red background (`#f0e1dd`), giving approximately **3.79:1** contrast at 14px normal weight. `--body` (`#46564b`) gives approximately **6.13:1** on that background. The latter is a small, local fix. [WCAG normal-text minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) is 4.5:1. Dark-mode versions of this pair are comfortably above that threshold.

5. **Initialize the topic map to a topic present in filtered results** (`app/site.tsx:20,25`). `Research` filters papers first, but `Atlas` always selects `Politics & place` initially. For a filter such as `Games & history`, switching to Topics can open an empty paper list despite matching entries. Pass the selected topic into Atlas or choose the first topic with a nonzero count, and update the selection when filters remove its last entry.

6. **Keep the Missing Variable fallback consistent with the current domain** (`app/site.tsx:21`). The live profile is correctly `https://themissingvariable.net/`; the GameCard fallback still points to GitHub Pages. This is not currently visible because the profile has a URL, but updating the fallback avoids a later regression when profile data is missing.

## Confirmed user preferences

- The home hero leads with the name, university, current role, real portrait and education; a featured paper is no longer at the top.
- SICSS has a prominent dedicated section immediately below the home hero and on Teaching.
- There is no decorative dot after the name. The late heading-color rule makes emphasized heading words inherit the same ink color.
- Grants and academic-service sections are not rendered. The CV’s short mention of service describes the document, not a reinstated service section.
- The prohibited unfinished-project/admissions narrative is absent from rendered Teaching copy. The mentorship section contains only the short supervision sentence.
- “Made to be played” and similar prior game slogans are absent. Current game links come from the profile, including the newly verified Missing Variable domain.
- Figure source/version captions and license links are rendered in both the page and the dialog. Scientific images retain their original colors in dark mode.

## Optional wide-viewport polish

At a physical 4K screen using 200% display scaling, the browser may expose only about 1920 CSS pixels; high DPI alone should not trigger larger layouts. At a genuinely wide CSS viewport, body text remains 16px and the page remains capped at 1320px. If browser QA finds the type too small, a modest typography breakpoint is reasonable:

```css
@media (min-width: 1800px) {
  html { font-size: 18px; }
  body { font-size: 1rem; }
  :root { --max: 1440px; --gutter: 72px; }
}
```

This is optional, not a demonstrated defect. Test 1920 and 3840 CSS-pixel widths plus 200% browser zoom before adopting it. Keep actual research images and portraits unchanged; typography and whitespace should carry the improvement.
