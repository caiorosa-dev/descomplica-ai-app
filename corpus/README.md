# Corpus de avaliação

20 documentos jurídicos usados nos testes da etapa 1 (snapshots), no seed e nos scripts de avaliação (`eval:corpus`, `eval:faults`). A lista está em [`manifest.json`](manifest.json).

## STJ (10 acórdãos, `court_decision`)

PDF do inteiro teor, obtido pela pesquisa de jurisprudência do STJ (SCON). O arquivo vem de `https://processo.stj.jus.br/SCON/GetInteiroTeorDoAcordao?num_registro=<registro>&dt_publicacao=<data>`.

| Arquivo | Processo | Registro | Publicação |
|---|---|---|---|
| `stj/resp-1969219-sp.pdf` | REsp 1.969.219/SP | 2021/0334345-3 | 28/03/2025 |
| `stj/resp-1999905-rs.pdf` | REsp 1.999.905/RS | 2022/0125230-9 | 19/02/2025 |
| `stj/resp-2025013-rj.pdf` | REsp 2.025.013/RJ | 2019/0040826-1 | 17/02/2025 |
| `stj/agint-agint-resp-1975502-sp.pdf` | AgInt no AgInt no REsp 1.975.502/SP | 2021/0375274-9 | 13/02/2025 |
| `stj/resp-2136836-sp.pdf` | REsp 2.136.836/SP | 2021/0221196-0 | 06/06/2025 |
| `stj/resp-2186037-am.pdf` | REsp 2.186.037/AM | 2024/0192224-5 | 26/03/2025 |
| `stj/resp-2200180-sp.pdf` | REsp 2.200.180/SP | 2022/0231505-2 | 18/08/2025 |
| `stj/resp-2109311-rj.pdf` | REsp 2.109.311/RJ | 2023/0405955-4 | 24/03/2025 |
| `stj/resp-2072052-rj.pdf` | REsp 2.072.052/RJ | 2023/0156208-0 | 26/03/2025 |
| `stj/hc-989426-pr.pdf` | HC 989.426/PR | 2025/0092122-1 | 09/06/2025 |

## CNJ (10 atos, `normative_act`)

PDF de cada ato em `https://atos.cnj.jus.br/atos/detalhar/<id>`.

| Arquivo | Ato | Versão | Subtipo |
|---|---|---|---|
| `cnj/res-335-2020.pdf` | Resolução 335/2020 | compilada | — |
| `cnj/res-401-2021.pdf` | Resolução 401/2021 | compilada | — |
| `cnj/res-455-2022.pdf` | Resolução 455/2022 | compilada | — |
| `cnj/rec-144-2023.pdf` | Recomendação 144/2023 | original | — |
| `cnj/res-550-2024.pdf` | Resolução 550/2024 | original | `amendment` |
| `cnj/res-560-2024.pdf` | Resolução 560/2024 | original | `amendment` |
| `cnj/rec-154-2024.pdf` | Recomendação 154/2024 | original | — |
| `cnj/res-600-2024.pdf` | Resolução 600/2024 | original | — |
| `cnj/res-615-2025.pdf` | Resolução 615/2025 | compilada | — |
| `cnj/res-674-2026.pdf` | Resolução 674/2026 | original | `amendment` |

Coleta em 18/10/2026. Os anexos em tabela (Res. 550, 615, Rec. 154, Res. 401) saem linearizados na extração do PDF; é uma limitação conhecida da PoC.
