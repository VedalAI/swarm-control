import { ApiClient, HelixUser } from "@twurple/api";
import { RefreshingAuthProvider } from "@twurple/auth";

const authProvider = new RefreshingAuthProvider({
    clientId: process.env.TWITCH_API_CLIENT_ID!,
    clientSecret: process.env.TWITCH_API_CLIENT_SECRET!,
});
const api = new ApiClient({ authProvider, batchDelay: 100 });

export async function getHelixUser(userId: string): Promise<HelixUser | null> {
    return api.users.getUserByIdBatched(userId);
}
