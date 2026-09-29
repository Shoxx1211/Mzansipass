import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const appFile = path.join(
  ROOT,
  "src",
  "app",
  "App.tsx",
);

const text = fs.readFileSync(
  appFile,
  "utf8",
);

let next = text;

// ============================================================
// 1. VERIFY EXISTING SAFEGUARDS
// ============================================================

if (
  !next.includes(
    "rec.selectable === false",
  )
) {
  throw new Error(
    "Existing recommendation selection guard was not found.",
  );
}

console.log(
  "Verified: recommendation selection guard",
);

if (
  !next.includes(
    "Mapbox currently supplies a road-driving duration.",
  ) &&
  !next.includes(
    "Mapbox's duration is currently a driving baseline.",
  )
) {
  throw new Error(
    "Safe plannedDurationSeconds implementation was not found.",
  );
}

console.log(
  "Verified: safe planned duration",
);

// ============================================================
// 2. ADD FARE ENGINE GUARD
// ============================================================

if (
  next.includes(
    'recommendation.fareStatus === "unverified"',
  )
) {
  console.log(
    "Already applied: FareEngine guard",
  );
} else {
  const marker =
    "            const networkName = recommendation.mode as TransitNetwork;";

  if (
    !next.includes(marker)
  ) {
    throw new Error(
      "Could not find recommendation fare enrichment marker.",
    );
  }

  next = next.replace(
    marker,
    `${marker}

            // Evidence-only recommendations must never be priced
            // using Mapbox's road-driving distance.
            if (
              recommendation.fareStatus ===
              "unverified"
            ) {
              return [
                networkName,
                null,
              ] as const;
            }`,
  );

  console.log(
    "Applied: FareEngine guard",
  );
}

// ============================================================
// 3. SAVE
// ============================================================

fs.writeFileSync(
  appFile,
  next,
  "utf8",
);

console.log("");
console.log(
  "==============================================",
);
console.log(
  " Rea Vaya App integration complete",
);
console.log(
  "==============================================",
);
console.log("");
console.log(
  "Updated: src/app/App.tsx",
);
console.log("");
console.log(
  "Next: npm.cmd run build",
);