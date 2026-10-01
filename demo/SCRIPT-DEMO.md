# TenderPilot — Script du demo vidéo final

Vérifié le 19/09/2026 sur le commit `faa8c72`, avec des temps mesurés sur l'application réelle.

**Message à faire passer :** TenderPilot analyse le tender, vérifie l'éligibilité et les preuves
disponibles, prépare le dossier technique, trace chaque exigence jusqu'à sa source, puis laisse
l'humain arbitrer et corriger.

---

## Avant d'enregistrer

1. Services actifs : API `:3001`, Web `:5173`, Docker postgres + redis. Vérifier `/health`.
2. Ouvrir **http://localhost:5173** (pas `127.0.0.1` — Vite écoute en IPv6).
3. **Ctrl+Shift+R** pour forcer le dernier bundle.
4. Navigateur en plein écran, barre de favoris masquée (Ctrl+Shift+B), onglet unique.
5. **N'enregistrer que la fenêtre du navigateur.** Le fichier `.env` est ouvert dans l'IDE —
   il ne doit jamais apparaître à l'image.

## Contrainte majeure : 101 s d'attente réelle

Les trois appels LLM sont réels et bloquants :

| Étape | Temps mesuré |
|---|---|
| Extraction (GPT-5.5) | **46 s** |
| Qualification + Compliance (GPT-5.5) | **27 s** |
| Rédaction (GPT-4.1) | **28 s** |

L'interface n'a ni routing ni liste de tenders : `currentTenderId` n'est défini qu'en cliquant sur
un fixture, ce qui relance toujours le pipeline complet. **Il est donc impossible d'afficher un
résultat déjà persisté sans réexécuter.** On enregistre donc d'une traite (~2 min 50) puis on coupe
les trois attentes au montage — voir `postprod.sh`.

Ne jamais couper au point de faire croire que c'est instantané : laisser ~4 s de panneau
« Running » visible à chaque étape. L'attente réelle fait partie de l'honnêteté du produit.

---

## Déroulé (durées = montage final)

| # | Temps | Écran | Action | À montrer |
|---|---|---|---|---|
| 1 | 0:00–0:09 | Dashboard | Arrêt sur le pipeline « How TenderPilot works » | Les 5 étapes + les modèles |
| 2 | 0:09–0:15 | Upload Tender | Clic **Upload Tender** → clic **AO-2026-001** (encadré) | La liste officielle AO-2026 |
| 3 | 0:15–0:19 | *(extraction)* | **COUPE 46 s → 4 s** | Panneau agent : Extract *Running* |
| 4 | 0:19–0:26 | Compliance Matrix | Arrivée automatique | 66 exigences, bandeau « Compliance not assessed yet » |
| 5 | 0:26–0:31 | Go / No-Go | Clic **Go / No-Go** → **Run qualification** | Profil entreprise chargé |
| 6 | 0:31–0:35 | *(qualification)* | **COUPE 27 s → 4 s** | Panneau agent : Qualify *Running* |
| 7 | 0:35–0:50 | Go / No-Go | Lecture calme du résultat | **NO-GO**, fit score, justification, blockers tracés |
| 8 | 0:50–1:06 | Compliance Matrix | Retour + taper **`Équipe projet`** dans la recherche | **1 seule exigence** : verdict *Compliant*, page 4, extrait, evidence `CV-01`, `CV-09` |
| 9 | 1:06–1:18 | Compliance Matrix | Effacer la recherche, remonter sur le radar | 4 compteurs, barre de couverture, Top blockers, Priority actions |
| 10 | 1:18–1:23 | Technical Proposal | Clic **Generate proposal** | — |
| 11 | 1:23–1:27 | *(rédaction)* | **COUPE 28 s → 4 s** | Panneau agent : Write *Running* |
| 12 | 1:27–1:35 | Technical Proposal | Survol de 2 sections | Sources utilisées, marqueur `[À COMPLÉTER]` s'il est présent |
| 13 | 1:35–1:50 | Human Review | Éditer une section, **Save correction** | Bandeau vert, badge *Human corrected*, **Download DOCX** |
| 14 | 1:50–1:58 | Upload → AO-2026-004 | Clic sur **AO-2026-004** (badge *Scanned*) | « Document requires human intervention », pages 1-4 illisibles, **0 exigence** |

**Total ≈ 1 min 58.** L'étape 14 est optionnelle : la couper si le montage dépasse 2:00.

### Points de vigilance

- **Le radar n'apparaît qu'après la qualification.** D'où l'ordre 4 → 5 → 8 : passer par Go/No-Go
  avant de revenir à la matrice. Sinon la matrice est sans verdicts.
- **Étape 8 :** taper `Équipe projet` donne exactement **1 résultat** — c'est ce qui permet de
  montrer une exigence sans dérouler les 66. `CNSS` en donne 3, `références` 3.
- **Étape 12 :** le marqueur `[À COMPLÉTER]` dépend de la génération. S'il est absent, ne pas le
  chercher : dire simplement que le rédacteur refuse d'inventer et laisse un marqueur quand la
  preuve manque. Ne jamais mettre en scène un résultat qui n'existe pas.
- Les chiffres varient d'une exécution à l'autre (GPT-5.5 tourne à sa température par défaut).
  Ne pas annoncer de chiffre à l'avance : lire à l'écran.

---

## Enregistrement — méthode la plus rapide (Windows 11, rien à installer)

**Xbox Game Bar** capture une *fenêtre*, jamais tout le bureau : l'IDE et le `.env` ne peuvent pas
fuiter.

1. Cliquer dans la fenêtre du navigateur.
2. **Win + Alt + R** pour démarrer. Un petit widget d'enregistrement apparaît.
3. Dérouler le scénario ci-dessus sans interruption.
4. **Win + Alt + R** pour arrêter.
5. Le fichier atterrit dans `C:\Users\yassi\Videos\Captures\`.

Si Game Bar est désactivé : `Paramètres → Jeux → Xbox Game Bar → Activer`.
Le micro se coupe/active avec **Win + Alt + M** si vous voulez commenter en direct.

Puis passer le brut dans `postprod.sh` pour couper les attentes et produire
`demo/TenderPilot_Demo_Final.mp4`.
