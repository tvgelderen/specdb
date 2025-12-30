export interface PublicEnvConfig {
	HOSTNAME: string;
}

function validatePublicEnv(): PublicEnvConfig {
	const HOSTNAME = import.meta.env.VITE_HOSTNAME ?? "http://localhost:3000";

	return {
		HOSTNAME,
	};
}

const publicEnv = validatePublicEnv();

export const HOSTNAME = publicEnv.HOSTNAME;
