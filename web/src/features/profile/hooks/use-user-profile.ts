import { useQuery } from '@tanstack/react-query';
import { userProfileService } from '@/features/profile/api/user-profile.service';

export function useUserProfile() {
  return useQuery({
    queryKey: ['user-profile'],
    queryFn: userProfileService.getProfile,
  });
}
