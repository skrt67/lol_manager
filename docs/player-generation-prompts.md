# Prompts generation joueurs pro (No Luck)

## 1) Prompt modele de donnees (a reutiliser)

Utilise ce modele JSON pour chaque joueur pro:

```json
{
  "id": "caps_g2",
  "pseudo": "Caps",
  "real_name": "Rasmus Winther",
  "team_id": "g2_esports",
  "league_id": "LEC",
  "league": "LEC",
  "role": "Mid",
  "stats": {
    "laning": 18,
    "teamfight": 19,
    "mechanics": 19,
    "macro": 18,
    "mental": 17
  },
  "signature_champions": ["Sylas", "LeBlanc", "Azir"],
  "value": 2500000
}
```

Contraintes:
- role doit etre dans: Top, Jungle, Mid, ADC, Support
- stats doivent etre notes FM de 1 a 20
- signature_champions doit contenir exactement 3 champions
- team_id et league_id sont obligatoires

## 2) Prompt LEC (Saison 2026)

Prompt:

Genere le fichier JSON des joueurs pour la LEC (Saison 2026).

Instructions:
- Inclus les 10 equipes: G2 Esports, Fnatic, Karmine Corp, Team Vitality, MAD Lions KOI, Team BDS, SK Gaming, Team Heretics, GIANTX, Rogue.
- Pour chaque equipe, cree les 5 joueurs titulaires (Top, Jungle, Mid, ADC, Support).
- Utilise le bareme Football Manager (notes 1 a 20).
- Sois realiste: un joueur elite comme Caps peut atteindre 19 en mechanics, alors qu'un rookie doit etre plutot entre 12 et 15.
- Ajoute leurs 3 champions signatures (maitrise 100%).
- Donne le resultat sous forme de code:
  const LEC_PLAYERS = [...]
- Chaque joueur doit respecter exactement le schema ci-dessous:
  id, pseudo, real_name, team_id, league_id, league, role, stats, signature_champions, value.

## 3) Prompt LFL (Saison 2026)

Prompt:

Genere le fichier JSON des joueurs pour la LFL (Saison 2026).

Instructions:
- Inclus les 10 equipes: Karmine Corp Blue, Vitality.Bee, Gentle Mates, GameWard, Aegis, BK ROG Esports, Solary, BDS Academy, Joblife, Izi Dream.
- Pour chaque equipe, cree les 5 joueurs titulaires (Top, Jungle, Mid, ADC, Support).
- Utilise le bareme Football Manager (notes 1 a 20).
- Niveau cible LFL (ERL): majoritairement entre 12 et 16, avec quelques profils stars pouvant atteindre 17.
- Ajoute 3 champions signatures par joueur.
- Donne le resultat sous forme:
  const LFL_PLAYERS = [...]
- Respecte strictement le schema joueur pro.

## 4) Prompt template pour les autres ligues

Prompt:

Genere le fichier JSON des joueurs pour la ligue {LEAGUE_ID} (Saison 2026).

Instructions:
- Inclus les {N} equipes officielles de la ligue.
- Pour chaque equipe, cree 5 titulaires: Top, Jungle, Mid, ADC, Support.
- Utilise le bareme Football Manager (1 a 20).
- Applique la hierarchie de tiers fournie.
- Ajoute 3 champions signatures par joueur.
- Donne le resultat sous forme:
  const {LEAGUE_ID}_PLAYERS = [...]
- Respecte strictement le schema joueur pro.

## 5) Hierarchie des tiers (equilibrage No Luck)

- Tier S (World Class - top LCK/LPL): notes majoritaires entre 17 et 20
- Tier A (Major leagues - top LEC/LCS): notes majoritaires entre 15 et 18
- Tier B (ERL - LFL/Prime/TCL): notes majoritaires entre 12 et 16

Regles pratiques:
- Les stars peuvent depasser la moyenne de leur tier sur 1 ou 2 stats clefs
- Les rookies restent en general entre 12 et 15 dans les ligues majeures
- Le mental ne doit pas etre oublie (impact no-luck sur resistance au tilt)
