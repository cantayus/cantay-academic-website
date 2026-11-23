# Methods-paper full-text review notes

All four assigned SSRN manuscripts were downloaded by root through the ordinary authorized browser download action, validated as PDFs, and reviewed locally. No CAPTCHA, paywall, or access-control bypass was used. All website figure assets are crops of the original paper figures/tables, rendered at 216 dpi. No charts were redrawn and no imagery was generated.

Review patches are separate from shared research.json and figures.json. Existing publication status, author records, and SSRN metadata were not changed.

## Owner/editorial decisions

- HalalLLM: the cover names Xinran Wang; owner explicitly confirmed Ciarrah Wang. Retain Ciarrah Wang in the public record.
- DEVISE: actual cover orders Junjie Zhao before Mingzhen Zhang; root should reconcile author array accordingly.
- DEVISE: abstract says 20 m sampling, methods say 50 m; source coverage begins in 2008 in Table 1 despite a nominal 2004–2024 frame. Do not claim uniform continuous two-decade coverage or repeat sampling spacing.
- DEVISE: the 1.44 million panoramas are not 1.44 million independent regression observations. Tables use 174 basic / 62 social-control county–date observations. Avoid causal partisan-benefit claims.
- ACROSS: 14 empirical tasks include two distinct U.S. cases; avoid advertising 14 unique countries. Tested empirical dimensions are 1–3 despite broader high-dimensional language elsewhere.
- ACROSS: benchmark labels are incomplete; precision/F1 comparisons and “false positive” labels require that caveat. Ensemble flags if any component flags, rather than majority voting.
- LUMOS: invalid/unparsable outputs excluded; valid N varies by model. Table 3 even has a MiniCPM N difference between raw boxes and SAM outputs. Do not present conditional IoU as complete end-to-end success rate.
- LUMOS: salient-object annotation overlap is the tested outcome, not eye-tracking attention or a direct explanation of what caused a model decision.
- HalalLLM: item scales mix attitudes with demographic/categorical questions, with imputed values for unusable replies. Avoid treating aggregate response values as a calibrated ideological axis or authentic historical beliefs.
- HalalLLM: the p14 prose inconsistently assigns Maimonides and Mernissi to religious categories compared with the corpus. No scholar-specific “global versus local” claim from that passage is repeated.

## Sources and unchanged PDF integrity

- lumos: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6296858; local public asset `/papers/lumos.pdf`; 25,499,821 bytes; SHA-256 `0a279a63f61be90a61ce3c9dbf5eaf5ddd642da0b1f48715343168b4c8ad47ab`.
- across: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5074429; local public asset `/papers/across.pdf`; 2,352,843 bytes; SHA-256 `5e4665215089507f799ada5543815b0a7577976900e7db6f4503e6c204f6dda8`.
- devise: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5371210; local public asset `/papers/devise.pdf`; 764,389 bytes; SHA-256 `b77f2404e4fb9982b79af8637bdc7b19d82ea05fae4c20e52c32dc15d15a32b0`.
- halalllm-kosherllm: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5372878; local public asset `/papers/halalllm-kosherllm.pdf`; 1,077,341 bytes; SHA-256 `d8c86e7d17668d974ccaafba7a3ae4dc87052b10b18b01a46110073d787b33e0`.

LUMOS is 25,499,821 bytes (about 24.32 MiB). Root will decide whether the deployment asset limit permits this unchanged copy; if omitted, use the authoritative SSRN full-text download link and update figure paperUrl links accordingly. Do not recompress or silently replace the source PDF.

Figure crop coordinates in source PDF points are recorded in the source helper outside the deployable project: ssrn-audit/methods-review/build-patches.py.
