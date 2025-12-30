import { createStart } from "@tanstack/react-start";

declare module "@tanstack/react-start" {
	interface Register {
		server: {
			requestContext: {
				fromFetch: boolean;
			};
		};
	}
}

export const startInstance = createStart(() => {
	return {
		defaultSsr: true,
	};
});
