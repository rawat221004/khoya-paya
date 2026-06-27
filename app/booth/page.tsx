"use client";

import Link from "next/link";
import { T } from "@/components/LanguageProvider";

const PATHS = [
  {
    href: "/booth/path-a",
    icon: "🧒",
    title: "Child / Cannot Respond",
    desc: "Volunteer fills everything on behalf of a child or a person unable to answer.",
    color: "border-amber-300 hover:border-amber-500 hover:bg-amber-50 text-amber-700",
  },
  {
    href: "/booth/path-b",
    icon: "🧓",
    title: "Elderly / Audio Assist",
    desc: "Big audio + visual tiles. Questions are spoken aloud and answers captured by voice.",
    color: "border-teal-300 hover:border-teal-500 hover:bg-teal-50 text-teal-700",
  },
  {
    href: "/booth/path-c",
    icon: "📝",
    title: "Standard Intake",
    desc: "Full form: photo, time, location, demographics and characteristics.",
    color: "border-sky-300 hover:border-sky-500 hover:bg-sky-50 text-sky-700",
  },
];

export default function BoothHome() {
  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-teal-700"><T>Intake Booth</T></h1>
        <p className="text-slate-500">
          <T>Who are we registering? Tap the option that fits the person in front of you.</T>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PATHS.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className={`flex flex-col items-center gap-3 rounded-2xl border-2 bg-white p-8 text-center shadow-sm transition active:scale-95 ${p.color}`}
          >
            <span className="text-6xl">{p.icon}</span>
            <span className="text-xl font-extrabold">{p.title}</span>
            <span className="text-sm font-normal text-slate-500">{p.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
