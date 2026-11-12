// Debe coincidir con POLICY_VERSION de backend/privacy.py: si cambia, todo el mundo vuelve a aceptar.
export const POLICY_VERSION = "2026-11";

export const consentIsCurrent = (user) => user?.consent?.version === POLICY_VERSION;
