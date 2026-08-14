import { LocationMapWorkspace } from "@/components/maps/location-map-workspace";
import styles from "./locations-route.module.css";

interface LocationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LocationsPage({ searchParams }: LocationsPageProps) {
  const params = await searchParams;
  const requestedProjectId = typeof params.projectId === "string" && params.projectId.trim()
    ? params.projectId.trim()
    : undefined;

  return (
    <div className={styles.route}>
      <LocationMapWorkspace
        mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? null}
        requestedProjectId={requestedProjectId}
        project={null}
        geographies={[]}
        candidates={[]}
      />
    </div>
  );
}
