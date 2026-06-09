import { useQuery } from '@tanstack/react-query';
import { userProfileService } from '@/services/userProfile.service';

export function useUserProfile() {
  return useQuery({
    queryKey: ['user-profile'],
    queryFn: userProfileService.getProfile,
  });
}
