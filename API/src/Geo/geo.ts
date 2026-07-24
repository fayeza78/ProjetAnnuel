// fonctions geo maison (aucune dependance). un quartier = un polygone GeoJSON,
// on doit detecter les chevauchements entre quartiers (une maison = un seul quartier)

export type Point = [number, number]; // [lng, lat]

// lit un texte GeoJSON et renvoie la liste des coins du polygone
// (l'anneau exterieur). si le texte n'est pas un polygone lisible -> null
export function lirePolygoneGeoJson(
  texteGeoJson: string | null | undefined,
): Point[] | null {
  if (!texteGeoJson) return null;

  let objetJson: unknown;
  try {
    objetJson = JSON.parse(texteGeoJson);
  } catch {
    return null;
  }

  // un GeoJSON peut arriver emballe dans une Feature, on va chercher la geometrie dedans
  const objet = objetJson as {
    type?: string;
    geometry?: unknown;
    coordinates?: unknown;
  };
  const geometrie = (objet.type === "Feature" ? objet.geometry : objet) as {
    type?: string;
    coordinates?: unknown;
  };
  if (
    !geometrie ||
    geometrie.type !== "Polygon" ||
    !Array.isArray(geometrie.coordinates)
  )
    return null;

  // coordinates[0] = le contour exterieur (les suivants seraient des trous, pas geres)
  const contourExterieur = geometrie.coordinates[0];
  if (!Array.isArray(contourExterieur) || contourExterieur.length < 3)
    return null;

  const coins: Point[] = [];
  for (const coordonnee of contourExterieur) {
    if (
      !Array.isArray(coordonnee) ||
      typeof coordonnee[0] !== "number" ||
      typeof coordonnee[1] !== "number"
    )
      return null;
    coins.push([coordonnee[0], coordonnee[1]]);
  }
  return coins;
}

// un coin est-il dedans ?
// si on est dedans et qu'on marche tout droit : on franchit 1 mur et on est dehors -> IMPAIR = dedans
// si on est dehors et qu'on traverse la maison : on franchit 2 murs (on entre puis on sort) -> PAIR = dehors
export function pointDansPolygone(point: Point, polygone: Point[]): boolean {
  const [x, y] = point;
  let dedans = false;
  // on parcourt chaque mur : du coin precedent (j) au coin actuel (i)
  for (let i = 0, j = polygone.length - 1; i < polygone.length; j = i++) {
    const [xCoinActuel, yCoinActuel] = polygone[i]!;
    const [xCoinPrecedent, yCoinPrecedent] = polygone[j]!;
    // le rayon part du point vers la droite : il touche ce mur si le mur
    // coupe la hauteur y du point, et que le croisement est a droite de x
    const rayonTraverseCeMur =
      yCoinActuel > y !== yCoinPrecedent > y &&
      x <
        ((xCoinPrecedent - xCoinActuel) * (y - yCoinActuel)) /
          (yCoinPrecedent - yCoinActuel) +
          xCoinActuel;
    if (rayonTraverseCeMur) dedans = !dedans;
  }
  return dedans;
}

// deux bords se croisent-ils ?
function segmentsSeCroisent(
  debutCoteA: Point,
  finCoteA: Point,
  debutCoteB: Point,
  finCoteB: Point,
): boolean {
  // produit en croix : de quel cote de la ligne (depart -> arrivee) est le point ?
  // positif = un cote, negatif = l'autre, 0 = aligne
  const cote = (depart: Point, arrivee: Point, point: Point) =>
    (arrivee[0] - depart[0]) * (point[1] - depart[1]) -
    (arrivee[1] - depart[1]) * (point[0] - depart[0]);
  const coteDebutA = cote(debutCoteB, finCoteB, debutCoteA);
  const coteFinA = cote(debutCoteB, finCoteB, finCoteA);
  const coteDebutB = cote(debutCoteA, finCoteA, debutCoteB);
  const coteFinB = cote(debutCoteA, finCoteA, finCoteB);
  // ca se croise si les 2 bouts de A sont de part et d'autre de B, et pareil dans l'autre sens
  return (
    ((coteDebutA > 0 && coteFinA < 0) || (coteDebutA < 0 && coteFinA > 0)) &&
    ((coteDebutB > 0 && coteFinB < 0) || (coteDebutB < 0 && coteFinB > 0))
  );
}

// verifie l'ensemble des cas via les fonctions segmentsSeCroisent et pointDansPolygone
export function polygonesSeChevauchent(
  polygoneA: Point[],
  polygoneB: Point[],
): boolean {
  if (polygoneA.some((coin) => pointDansPolygone(coin, polygoneB))) return true;
  if (polygoneB.some((coin) => pointDansPolygone(coin, polygoneA))) return true;

  // aucun coin dedans mais ca peut quand meme se croiser (cas de la croix :
  // les 2 formes se coupent sans qu'aucun coin soit dans l'autre)
  // donc on teste chaque cote de A contre chaque cote de B
  for (let i = 0; i < polygoneA.length; i++) {
    // un cote = 2 coins qui se suivent : polygoneA[i] -> polygoneA[i+1]
    const debutCoteA = polygoneA[i]!;
    // le % ferme la forme : au dernier coin, (i+1) revient a 0 (sinon polygoneA[4] = undefined)
    const finCoteA = polygoneA[(i + 1) % polygoneA.length]!;
    for (let j = 0; j < polygoneB.length; j++) {
      // pareil pour le cote de B
      const debutCoteB = polygoneB[j]!;
      const finCoteB = polygoneB[(j + 1) % polygoneB.length]!;
      // un seul croisement suffit, on sort direct
      if (segmentsSeCroisent(debutCoteA, finCoteA, debutCoteB, finCoteB))
        return true;
    }
  }
  // aucun coin dedans et aucun cote croise : les 2 quartiers ne se touchent pas
  return false;
}
