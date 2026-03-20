import DashboardLayout from "@/components/dashboard/DashboardLayout";
import GameList from "./GameList";
import { getGameConfig, isValidGameType } from "@/app/games/registry";
import { notFound } from "next/navigation";

export default function GamesPage({ params }: { params: { gameType: string } }) {
    if (!isValidGameType(params.gameType)) notFound();
    const config = getGameConfig(params.gameType);

    return (
        <DashboardLayout>
            <div className="container mx-auto p-6">
                <h1 className="text-3xl font-bold mb-2">{config.displayName} Games</h1>
                <p className="text-muted-foreground mb-6">
                    Games stored on the Verus blockchain as SubIDs under {config.parentIdentityName}
                </p>
                {config.chainEnabled ? (
                    <GameList gameType={params.gameType} />
                ) : (
                    <p className="text-muted-foreground">Chain storage not yet available for {config.displayName}.</p>
                )}
            </div>
        </DashboardLayout>
    );
}
