/**
 * Reversible loyalty cutover. Older points stay only as historical records;
 * never convert an old balance into stamps, and never zero a profile.
 * The switch is explicitly off in staging and until release approval.
 */
export function stampsReplacePoints(env){
  return env?.SITE_MODE==="production" &&
    env?.WALLET_ENABLED==="yes" &&
    env?.WALLET_REPLACE_LEGACY==="yes" &&
    env?.PUBLISH_APPROVED==="yes";
}
export function visitPointsAwarded(env){
  return stampsReplacePoints(env) ? 0 : 10;
}
export function immutableLegacyBalances(target,proposed,env){
  if(!stampsReplacePoints(env))return proposed;
  return {points:target.points,lifetime_points:target.lifetime_points};
}
