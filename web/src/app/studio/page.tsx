import type { Metadata } from "next";
import { LucyStudio } from "@/components/LucyStudio";

export const metadata: Metadata = {
  title: "Lucy Studio - AI film director",
  description: "Add your people and place, describe the scene, and Lucy directs it: camera angles, coverage, voices and the edit. Free storyboard, pay as you go.",
  alternates: { canonical: "/studio" },
  openGraph: { title: "Lucy Studio | Lucy Labs", description: "Describe a scene - Lucy directs it. Free storyboard, pay as you go.", url: "/studio" },
};

export default function StudioPage() {
  return <LucyStudio />;
}
