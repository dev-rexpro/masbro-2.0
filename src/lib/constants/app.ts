export const APP_NAME = import.meta.env?.VITE_PUBLIC_APP_NAME || 'Omnichat';

export const DEMO_MODE = import.meta.env?.VITE_PUBLIC_DEMO_MODE === 'true' || import.meta.env?.DEV;
