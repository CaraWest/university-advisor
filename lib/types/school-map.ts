/** Row from GET /api/schools/map for Leaflet markers and filters. */

export type SchoolMapRow = {
  id: string;
  name: string;
  state: string;
  city: string | null;
  institutionType: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  distanceFromHome: number | null;
  athleticTier: string | null;
};
