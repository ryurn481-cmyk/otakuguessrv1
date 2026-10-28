import { CharacterGame } from "@/components/game/character/character-game";
import { Suspense } from "react";

export default function CharacterPage() {
  return <Suspense><CharacterGame /></Suspense>;
}
