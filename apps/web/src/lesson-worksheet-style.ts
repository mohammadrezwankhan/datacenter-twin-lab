// Self-contained print styles: no web fonts, images, scripts, or remote requests.
export const worksheetStyle = `
* { box-sizing: border-box; }
:root { color-scheme: light; font-family: Arial, Helvetica, sans-serif; color: #163344; }
body { margin: 0; background: #edf2f5; font-size: 14px; line-height: 1.45; overflow-wrap: anywhere; }
a { color: #125e69; overflow-wrap: anywhere; }
main { max-width: 840px; margin: auto; padding: 20px; }
.sheet { background: white; padding: 30px; margin: 0 0 24px; border-top: 5px solid #176b69; }
header { display: flex; justify-content: space-between; gap: 20px;
  border-bottom: 1px solid #b8c8d1; padding-bottom: 10px; font-size: 11px; }
.kicker { color: #176b69; font-size: 11px; font-weight: bold;
  letter-spacing: .1em; text-transform: uppercase; }
h1 { font-size: 27px; line-height: 1.18; margin: 18px 0 10px; }
h2 { font-size: 21px; line-height: 1.22; margin: 20px 0 10px; }
h3 { font-size: 15px; margin: 15px 0 6px; }
p { margin: 8px 0; }
.question { font-size: 18px; font-weight: bold; }
.input, .result { border-left: 4px solid #176b69; background: #eff7f5; padding: 12px 16px; }
.result strong { display: block; font-size: 25px; overflow-wrap: anywhere; }
.small { font-size: 11px; color: #455b66; }
table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 12px; }
caption { text-align: left; font-weight: bold; margin: 4px 0; }
th, td { padding: 5px 7px; text-align: left; vertical-align: top; border-bottom: 1px solid #d2dce1; }
th { color: #163344; font-weight: bold; }
tbody th { width: 44%; }
thead { background: #edf3f6; }
code, pre { font-family: Consolas, monospace; overflow-wrap: anywhere; white-space: pre-wrap; }
code { font-size: 11px; }
ol, ul { margin: 7px 0; padding-left: 22px; }
li { margin: 4px 0; }
.write-line { height: 24px; border-bottom: 1px solid #b8c8d1; }
.estimate { min-height: 28px; font-size: 16px; }
.rule { border-top: 1px solid #b8c8d1; padding-top: 8px; margin-top: 14px; }
figure { margin: 14px 0; }
svg { display: block; width: 100%; height: auto; }
figcaption { font-size: 11px; color: #455b66; }
.hash { font-size: 10px; overflow-wrap: anywhere; }
.full-data { padding: 20px; background: white; }
.full-data pre { max-height: 400px; overflow: auto; font-size: 11px; }
footer { border-top: 1px solid #b8c8d1; margin-top: 14px; padding-top: 8px; font-size: 10px; }
@media (max-width: 520px) {
  main { padding: 8px; }
  .sheet { padding: 16px; }
  h1 { font-size: 23px; }
  th, td { padding: 4px; overflow-wrap: anywhere; }
  header { gap: 8px; }
}
@page { size: auto; margin: 14mm; }
@media print {
  body { background: white; font-size: 10pt; line-height: 1.3; }
  main { padding: 0; max-width: none; }
  .sheet { padding: 12px 0 0; margin: 0; break-before: page; page-break-before: always; }
  .sheet:first-child { break-before: auto; page-break-before: auto; }
  h1 { font-size: 21pt; }
  h2 { font-size: 17pt; }
  h3 { font-size: 11pt; }
  .question { font-size: 13pt; }
  table { font-size: 8.5pt; }
  th, td { padding: 4px 6px; }
  .small, figcaption { font-size: 8pt; }
  header, footer, .kicker { font-size: 8pt; }
  .result strong { font-size: 20pt; }
  .result, figure, tr, .write-line { break-inside: avoid; }
  h1, h2, h3, caption { break-after: avoid; }
  .full-data, .screen-only { display: none; }
  a { color: inherit; text-decoration: none; }
}
`;
