/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GameMasterFile, Pokemon, Ranking1500Target } from '../types/pokemon.types';
import { getPokemonGamemasterData } from './gamemaster';

export function getCandidates(
  pokemonStorage: Pokemon[],
  scoreMin: number,
  cpMax: number,
  gameMaster: GameMasterFile,
  rankingsRaw: Ranking1500Target[]
): { [key: string]: Pokemon[] } | null {
  const rankings = rankingsRaw.map((p, index) => ({ ...p, position: index + 1 }));
  const candidatesByTarget: { [key: string]: Pokemon[] } = {};
  for (const potentialTarget of rankings) {
    if (potentialTarget.score <= scoreMin) continue;
    const targetParentSpeciesIds: string[] = [potentialTarget.speciesId];
    const potentialTargetGM = getPokemonGamemasterData(potentialTarget.speciesId, gameMaster);
    let targetParentSpeciesId: string | null =
      potentialTargetGM?.family?.parent ?? null;

    while (targetParentSpeciesId != null) {
      const parentEntry = getPokemonGamemasterData(targetParentSpeciesId, gameMaster);
      if (!parentEntry) break;
      targetParentSpeciesIds.push(parentEntry.speciesId);
      targetParentSpeciesId = parentEntry.family?.parent ?? null;
    }

    const pvpIvChart = calculate(
      potentialTargetGM.baseStats?.atk ?? 0,
      potentialTargetGM.baseStats?.def ?? 0,
      potentialTargetGM.baseStats?.hp ?? 0,
      0,
      1,
      50,
      false,
      cpMax ?? 1500
    );


    const ivChartLength = Object.keys(pvpIvChart).length;
    const candidates = pokemonStorage.filter(
      (p) =>
        targetParentSpeciesIds.includes(p.speciesId) &&
        Object.entries(pvpIvChart).find((ivChartEntry, index) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const [_, ivChart] = ivChartEntry;
          return (
            ivChart.find((option) => {

              if (
                option.IVs.A === p.stats.ivs.attack &&
                option.IVs.D === p.stats.ivs.defense &&
                option.IVs.S === p.stats.ivs.stamina
              ) {
const rankPercentile = ((ivChartLength - index) / ivChartLength) * 100;
if (rankPercentile < scoreMin) {
                return false; // Not matching the scoreMin
}
                p.rank = {
                  index: potentialTarget.position,
                  percentile: rankPercentile,
                  score: potentialTarget.score,
                };
                return true;
              }
              return false;
            }) != null
          );
        })
    );

    if (candidates.length == 0) {
      //console.warn(`No matching stat product found`);
      //return false; // No matching stat product found
    }
    // const uniqueCandidates = uniqBy(
    //   candidates,
    //   (p) => p.speciesId + p.stats.ivs.attack + p.stats.ivs.defense + p.stats.ivs.stamina + p.stats.cp
    // );
    const updatedCandidates = candidates.map((p) => {
      p.rankTarget = potentialTarget;
      return p;
    });
    candidatesByTarget[potentialTarget.speciesId] = updatedCandidates;
  }

  return candidatesByTarget ?? null;
}

/**
 * CP modifiers at each level
 * cpm array used for calculations, source: https://www.reddit.com/r/TheSilphRoad/comments/jwjbw4/level_4550_expected_cpms_based/
 */
export const cpm: number[] = [
  0.0939999967813491, 0.135137430784308, 0.166397869586944, 0.192650914456886, 0.215732470154762, 0.236572655026622,
  0.255720049142837, 0.273530381100769, 0.29024988412857, 0.306057381335773, 0.321087598800659, 0.335445032295077,
  0.349212676286697, 0.36245774877879, 0.375235587358474, 0.387592411085168, 0.399567276239395, 0.41119354951725,
  0.422500014305114, 0.432926413410414, 0.443107545375824, 0.453059953871985, 0.46279838681221, 0.472336077786704,
  0.481684952974319, 0.490855810259008, 0.499858438968658, 0.508701756943992, 0.517393946647644, 0.525942508771329,
  0.534354329109191, 0.542635762230353, 0.550792694091796, 0.558830599438087, 0.566754519939422, 0.574569148039264,
  0.582278907299041, 0.589887911977272, 0.59740000963211, 0.604823657502073, 0.61215728521347, 0.61940411056605,
  0.626567125320434, 0.633649181622743, 0.640652954578399, 0.647580963301656, 0.654435634613037, 0.661219263506722,
  0.667934000492096, 0.674581899290818, 0.681164920330047, 0.687684905887771, 0.694143652915954, 0.700542893277978,
  0.706884205341339, 0.713169102333341, 0.719399094581604, 0.725575616972598, 0.731700003147125, 0.734741011137376,
  0.737769484519958, 0.740785574597326, 0.743789434432983, 0.746781208702482, 0.749761044979095, 0.752729105305821,
  0.75568550825119, 0.758630366519684, 0.761563837528228, 0.764486065255226, 0.767397165298461, 0.77029727397159,
  0.77318650484085, 0.776064945942412, 0.778932750225067, 0.781790064808426, 0.784636974334716, 0.787473583646825,
  0.790300011634826, 0.792803950958807, 0.795300006866455, 0.79780392148697, 0.800300002098083, 0.802803892322847,
  0.805299997329711, 0.807803863460723, 0.81029999256134, 0.812803834895026, 0.815299987792968, 0.817803806620319,
  0.820299983024597, 0.822803778631297, 0.825299978256225, 0.827803750922782, 0.830299973487854, 0.832803753381377,
  0.835300028324127, 0.837803755931569, 0.840300023555755, 0.842803729034748, 0.845300018787384, 0.847803702398935,
  0.850300014019012, 0.852803676019539, 0.85530000925064, 0.857803649892077, 0.860300004482269, 0.862803624012168,
  0.865299999713897,
];

export function calculate(
  baseatk: number,
  basedef: number,
  basesta: number,
  floor: number,
  minLvl: number,
  maxLvl: number,
  invalid: any,
  league: number
): { [key: string]: { IVs: { A: number; D: number; S: number; star: string }; CP: number }[] } {
  /* returns sorted list of all (up to 4096) combinations indexed by statProd + CP */ /*console.log("calculate: Received: baseatk="+baseatk+" basedef="+basedef+" basesta="+basesta+" league="+league+" floor="+floor+" minLvl="+minLvl);*/ /* Each item stored by statProd.CP */ /* Rank definition:{"12613615.1500":{"IVs":{"A":14, "D":14, "S":14, "star": "3*"}, "base":{"A":145, "D":105, "S":115}, "battle":{"A":145, "D":105, "S":115}, "L":25}, */
  const ranks: any[number] = [],
    invalids = [];
  const maxAtk = { value: 0, aIV: 0, dIV: 0, sIV: 0, sp: 0 };
  const maxDef = { value: 0, aIV: 0, dIV: 0, sIV: 0, sp: 0 };
  const maxHP = { value: 0, aIV: 0, dIV: 0, sIV: 0, sp: 0 };
  const minAtk = { value: 1000, aIV: 0, dIV: 0, sIV: 0, sp: 0 };
  const minDef = { value: 1000, aIV: 0, dIV: 0, sIV: 0, sp: 0 };
  const minHP = { value: 1000, aIV: 0, dIV: 0, sIV: 0, sp: 0 };
  let minRankLvl = 100;
  let maxRankLvl = 0;
  let numRanks = 0;
  /* account for half-level CPMs (40-1)*2=78 */ minLvl = Math.max(0, (minLvl - 1) * 2);
  /* use half-levels */ maxLvl = Math.max(0, (maxLvl - 1) * 2);
  /* use half-levels */ for (let atk = floor / 1; atk <= 15; atk++) {
    for (let def = floor / 1; def <= 15; def++) {
      for (let sta = floor / 1; sta <= 15; sta++) {
        for (let level = maxLvl; level >= minLvl; level--) {
          const cp = Math.max(
            10,
            Math.floor(
              ((baseatk + atk) * Math.sqrt(basedef + def) * Math.sqrt(basesta + sta) * cpm[level] * cpm[level]) / 10
            )
          );
          if (league && cp > league) {
            if (level == minLvl && invalid) {
              invalids.push({ A: atk, D: def, S: sta, cp: cp });
            }
            continue; /* keep searching for level */
          }
          /* Update maxLvl on first loop (0/0/0 or floor/floor/floor) to optimize performance */ if (
            atk === floor / 1 &&
            def === floor / 1 &&
            sta === floor / 1
          ) {
            maxLvl = level;
          }
          const aSt = (baseatk + atk) * cpm[level];
          const dSt = (basedef + def) * cpm[level];
          const sSt = Math.max(10, Math.floor((basesta + sta) * cpm[level]));
          const statProd = Math.round(aSt * dSt * sSt);
          /* update maxStats if necessary */ if (maxAtk.value < aSt || (maxAtk.sp < statProd && maxAtk.value <= aSt)) {
            maxAtk.value = aSt;
            maxAtk.aIV = atk;
            maxAtk.dIV = def;
            maxAtk.sIV = sta;
            maxAtk.sp = statProd;
          }
          if (maxDef.value < dSt || (maxDef.sp < statProd && maxDef.value <= dSt)) {
            maxDef.value = dSt;
            maxDef.aIV = atk;
            maxDef.dIV = def;
            maxDef.sIV = sta;
            maxDef.sp = statProd;
          }
          if (maxHP.value < sSt || (maxHP.sp < statProd && maxHP.value <= sSt)) {
            maxHP.value = sSt;
            maxHP.aIV = atk;
            maxHP.dIV = def;
            maxHP.sIV = sta;
            maxHP.sp = statProd;
          }
          if (level / 1 > maxRankLvl / 1) {
            maxRankLvl = level;
          }
          /* update minStats if necessary */ if (minAtk.value > aSt || (minAtk.sp < statProd && minAtk.value >= aSt)) {
            minAtk.value = aSt;
            minAtk.aIV = atk;
            minAtk.dIV = def;
            minAtk.sIV = sta;
            minAtk.sp = statProd;
          }
          if (minDef.value > dSt || (minDef.sp < statProd && minDef.value >= dSt)) {
            minDef.value = dSt;
            minDef.aIV = atk;
            minDef.dIV = def;
            minDef.sIV = sta;
            minDef.sp = statProd;
          }
          if (minHP.value > sSt || (minHP.sp < statProd && minHP.value >= sSt)) {
            minHP.value = sSt;
            minHP.aIV = atk;
            minHP.dIV = def;
            minHP.sIV = sta;
            minHP.sp = statProd;
          }
          if (level / 1 < minRankLvl / 1) {
            minRankLvl = level;
          }
          const IVsum = atk / 1 + def / 1 + sta / 1;
          let Star = 'NA';
          if (IVsum < 23) {
            Star = '0*';
          } else if (IVsum < 30) {
            Star = '1*';
          } else if (IVsum < 37) {
            Star = '2*';
          } else if (IVsum < 45) {
            Star = '3*';
          } else {
            Star = '4*';
          }
          level = level / 2 + 1;
          /* store as arrays to prevent hash collisions from dropping entires */ /* Tie Breaking Order: 1)StatProd -> 2)AtkStat -> 3)HPval -> 4)finalCP -> 5)StaIV -> 6)ERROR */
          const newIndex = statProd + '.' + Math.round(100000 * aSt);
          if (!(newIndex in ranks)) {
            ranks[newIndex] = [
              { IVs: { A: atk, D: def, S: sta, star: Star }, battle: { A: aSt, D: dSt, S: sSt }, L: level, CP: cp },
            ];
          } else {
            let i;
            const ranksLen = ranks[newIndex].length;
            for (i = 0; i < ranksLen; i++) {
              if (sSt > ranks[newIndex][i].battle.S) {
                break;
              } else if (sSt == ranks[newIndex][i].battle.S) {
                if (cp > ranks[newIndex][i].CP) {
                  break;
                } else if (cp == ranks[newIndex][i].CP) {
                  if (sta > ranks[newIndex][i].IVs.S) {
                    /*console.log("Used 5th tie breaker (Stamina IV) for newIndex("+newIndex+"):"+JSON.stringify(ranks[newIndex]));*/ break;
                  } else if (sta == ranks[newIndex][i].IVs.S) {
                    console.log(
                      'Need 6th tie breaker for newIndex(' + newIndex + '):' + JSON.stringify(ranks[newIndex])
                    );
                  }
                }
              }
            }
            ranks[newIndex].splice(i, 0, {
              IVs: { A: atk, D: def, S: sta, star: Star },
              battle: { A: aSt, D: dSt, S: sSt },
              L: level,
              CP: cp,
            });
          }
          numRanks = numRanks + 1;
          break; /* stop evaluating this IV combination */
        }
      }
    }
  }
  // /* sort by statProd+CP before returning */ if (perfTiming) {
  //   Tb = performance.now();
  // }
  const sorted: Record<string, any> = {};
  Object.keys(ranks)
    .sort(function (a, b) {
      // @ts-expect-error idk but its fine.
      return b - a;
    })
    .forEach(function (key) {
      sorted[key] = ranks[key];
    });
  // /* add max stats to object */ sorted.maxAtk = maxAtk;
  // sorted.maxDef = maxDef;
  // sorted.maxHP = maxHP;
  // sorted.minAtk = minAtk;
  // sorted.minDef = minDef;
  // sorted.minHP = minHP;
  // sorted.minLvl = 1 + minRankLvl / 2;
  // sorted.maxLvl = 1 + maxRankLvl / 2;
  // sorted.numRanks = numRanks;
  // sorted.invalids = invalids;
  // /* console.log("calculate output:"+JSON.stringify(sorted, null, 2)); */ if (perfTiming) {
  //   T1 = performance.now();
  //   console.log(
  //     mon +
  //       ' calculate: ' +
  //       (T1 - T0).toFixed(1) +
  //       'ms (Build ' +
  //       (Tb - T0).toFixed(1) +
  //       'ms + Sort ' +
  //       (Ts - Tb).toFixed(1) +
  //       'ms) for ' +
  //       numRanks +
  //       ' ranks.'
  //   );
  // document.getElementById('timing_outputs').innerHTML +=
  //   'calculate: ' +
  //   (T1 - T0).toFixed(1) +
  //   'ms (Build ' +
  //   (Tb - T0).toFixed(1) +
  //   'ms + Sort ' +
  //   (Ts - Tb).toFixed(1) +
  //   'ms) for ' +
  //   numRanks +
  //   ' ranks.<br>';
  //}
  return sorted;
}
