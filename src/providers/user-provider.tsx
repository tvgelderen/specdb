import { createContext, useContext } from "react";

type UserContextType = {
	user: null;
	isLoading: false;
};

const UserContext = createContext<UserContextType>({
	user: null,
	isLoading: false,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
	return (
		<UserContext.Provider
			value={{
				user: null,
				isLoading: false,
			}}
		>
			{children}
		</UserContext.Provider>
	);
}

export function useUser() {
	const context = useContext(UserContext);
	if (context === undefined) {
		throw new Error("useUser must be used within a UserProvider");
	}
	return context;
}
