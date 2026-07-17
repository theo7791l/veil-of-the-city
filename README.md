# VEIL OF THE CITY

> Démo verticale slice d'un jeu d'infiltration/parkour 3D WebGL.  
> Incarnez **Samir Vey**, messager des *Veilleurs du Voile*, dans la cité portuaire fictive de **Qasr Al-Nour**.

## Lancement rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer le serveur de développement
npm run dev
# → Ouvrir http://localhost:3000

# 3. Build de production
npm run build
npm run preview
```

## Contrôles

| Touche | Action |
|--------|--------|
| Z / W | Avancer |
| S | Reculer |
| Q / A | Gauche |
| D | Droite |
| Souris | Caméra |
| Espace | Saut / Grimper |
| Shift | Sprint |
| Ctrl | S'accroupir |
| E | Interagir |
| F | Élimination silencieuse |
| Clic gauche | Attaque |
| Clic droit | Bloquer / Esquiver |
| R (maintenir) | Lecture des Échos |
| F3 | Mode debug |
| Échap | Pause |

## Structure

```
src/
  main.ts
  game/
    Game.ts           — boucle principale
    GameState.ts      — état global
    EventBus.ts       — bus d'événements
  entities/
    Player.ts         — contrôleur joueur
    Guard.ts          — IA garde
    Civilian.ts       — PNJ civil
  systems/
    ParkourSystem.ts
    StealthSystem.ts
    CombatSystem.ts
    AISystem.ts
    MissionSystem.ts
    InteractionSystem.ts
    SaveSystem.ts
  world/
    CityBuilder.ts    — génération procédurale de la ville
    NavigationGraph.ts
    CollisionWorld.ts
    Lighting.ts
  ui/
    HUD.ts
    Menu.ts
    PauseMenu.ts
    MissionUI.ts
  assets/
    ProceduralMaterials.ts
    ProceduralAudio.ts
  styles/
    main.css
```

## Fonctionnalités implémentées

- ✅ Rendu Three.js WebGL2 avec dégradation WebGL1
- ✅ Ville procédurale Qasr Al-Nour (ruelles, arches, toits, quais, tours)
- ✅ Système de parkour : saut, sprint, accrochage rebord, montée, roulade
- ✅ Caméra 3e personne avec collision raycast et FOV dynamique
- ✅ Infiltration : cône de vision, ouïe, suspicion par garde
- ✅ IA garde : 5 états (patrouille, suspicion, investigation, alerte, retour)
- ✅ 3 types de gardes : sentinelle, patrouilleur, lourd
- ✅ Combat : attaque, blocage, esquive, élimination silencieuse
- ✅ Lecture des Échos (vision de repérage)
- ✅ Mission complète en 7 étapes
- ✅ PNJ civils simples
- ✅ HUD minimaliste (vie, énergie, objectif, détection)
- ✅ Menu titre, menu pause, écran de fin
- ✅ Audio procédural (Web Audio API)
- ✅ Sauvegarde localStorage
- ✅ Mode debug F3
- ✅ Détection de performance adaptative
- ✅ Tous textes en français

## Améliorations possibles

- Animations squelettales via SkinnedMesh Three.js
- Navigation NavMesh complète (Recast.js)
- Ombres dynamiques haute résolution
- Effets post-process (bloom, SSAO via pmndrs/postprocessing)
- Dialogues et sous-titres étendus
- Sauvegardes multi-slots
- Mode mobile avec joystick virtuel
- Missions supplémentaires
- Multijoueur asynchrone (scores leaderboard)
