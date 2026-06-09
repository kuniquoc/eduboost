using System.Security.Claims;

namespace EduBoost.API.Common.Http;

public static class ControllerAuth
{
    public static Guid GetUserId(ClaimsPrincipal user) =>
        Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue("sub")
            ?? Guid.Empty.ToString());

    public static string GetUserRole(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.Role) ?? user.FindFirstValue("role") ?? "student";
}
