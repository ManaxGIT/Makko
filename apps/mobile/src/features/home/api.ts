import { ExploreRequest } from '@/features/explore/api';
import { apiGet } from '@/lib/api';

export type HomeDashboard = {
  profile: {
    id: string;
    displayName: string;
    avatarPath: string | null;
  };
  location: {
    ward: string | null;
    district: string | null;
    city: string;
    latitude: number;
    longitude: number;
  } | null;
  nearbyRequests: ExploreRequest[];
};

export async function getHomeDashboard({
  nearbyLimit = 5,
}: {
  nearbyLimit?: number;
} = {}): Promise<HomeDashboard> {
  return apiGet<HomeDashboard>('/api/v1/home', {
    nearby_limit: nearbyLimit,
  });
}
