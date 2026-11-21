/**
 * Bellaquitas Fest — enlaces legítimos de OAuth y correo al cambiar de host.
 * Staging conserva /preview y /espejo. El dominio final usa la portada /
 * porque /preview está cerrado expresamente en producción.
 *
 * No registrar ni mostrar los tokens: uso solo en enlaces privados enviados
 * por el proveedor de correo. El frontend borra los tokens del historial.
 */
export function googleLanding(state, env) {
  if (typeof state !== "string") throw Error("Estado OAuth inválido");
  if (state.startsWith("A")) return "/administracion/";
  if (env?.SITE_MODE === "production") return "/#/mi-espacio";
  return state.startsWith("M") ? "/espejo/#/mi-espacio" : "/preview";
}

export function emailLink(origin, rawToken, purpose, requestedReturn, env) {
  if (typeof origin !== "string" || !/^https:\/\/[^/]+$/.test(origin))
    throw Error("Origen de correo inválido");
  if (typeof rawToken !== "string" ||
      !/^[a-zA-Z0-9_-]{43}$/.test(rawToken))
    throw Error("Token no válido");
  if (!["verify", "reset"].includes(purpose))
    throw Error("Operación de correo no permitida");
  const isVerify = purpose === "verify";
  // En producción, la página original está en / y el UI lee estos nombres
  // de parámetros para confirmar/resetear sin romper la navegación normal.
  if (env?.SITE_MODE === "production")
    return origin + "/?" + (isVerify ? "verify" : "reset_token") + "=" +
      rawToken + (isVerify ? "#/acceso" : "#/restablecer");
  if (requestedReturn === "espejo")
    return origin + "/espejo/?" + (isVerify ? "verify" : "reset_token") +
      "=" + rawToken + (isVerify ? "#/acceso" : "#/restablecer");
  // Se conserva retrocompatibilidad EXACTA de emails antiguos de staging.
  return origin + "/preview#" + (isVerify ? "verify=" : "reset=") + rawToken;
}
