import { clubHeaders } from "@/app/club.js";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: clubHeaders(body ? { "Content-Type": "application/json" } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("No se ha podido conectar con el servidor", 0);
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const fallback = response.status === 422 ? "Revisa los datos del formulario" : "Algo ha fallado. Inténtalo de nuevo";
    const detail = typeof data?.detail === "string" ? data.detail : fallback;
    throw new ApiError(detail, response.status);
  }
  return data;
}

export const getAuthConfig = () => request("/auth/config");
export const getMe = () => request("/auth/me");
export const loginWithGoogle = (credential) =>
  request("/auth/google", { method: "POST", body: { credential } });
export const registerAccount = (account) => request("/auth/register", { method: "POST", body: account });
export const loginWithPassword = (username, password) =>
  request("/auth/login", { method: "POST", body: { username, password } });
export const changePassword = (currentPassword, newPassword) =>
  request("/auth/password", { method: "POST", body: { current_password: currentPassword, new_password: newPassword } });
export const setUpPassword = (username, password) =>
  request("/auth/password/setup", { method: "POST", body: { username, password } });
export const createTemporaryPassword = (userId) =>
  request(`/users/${encodeURIComponent(userId)}/temporary-password`, { method: "POST" });
export const logout = () => request("/auth/logout", { method: "POST" });
export const saveCharacter = (look) => request("/profile/character", { method: "PUT", body: look });
export const getProfile = () => request("/profile");
export const getCoins = () => request("/coins");
export const getShop = () => request("/shop");
export const buyShopItem = (itemId) => request("/shop/buy", { method: "POST", body: { item_id: itemId } });
export const getRankingHonors = (groupId) => request(`/ranking/honors?group_id=${encodeURIComponent(groupId)}`);
export const updateProfile = (changes) => request("/profile", { method: "PATCH", body: changes });
export const deleteAvatar = () => request("/profile/avatar", { method: "DELETE" });
export const saveConsent = (consent) => request("/profile/consent", { method: "PUT", body: { accepted: true, ...consent } });
export const deleteAccount = () => request("/profile", { method: "DELETE", body: { confirm: "BORRAR" } });
export async function uploadAvatar(blob) {
  let response;
  try {
    response = await fetch("/api/profile/avatar", {
      method: "PUT",
      credentials: "same-origin",
      headers: clubHeaders({ "Content-Type": blob.type }),
      body: blob,
    });
  } catch {
    throw new ApiError("No se ha podido conectar con el servidor", 0);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(typeof data?.detail === "string" ? data.detail : "No se ha podido subir la foto", response.status);
  return data;
}
export const listUsers = () => request("/users");
// Copia de seguridad (solo administradores): se descarga como archivo.
export async function downloadBackup() {
  let response;
  try {
    response = await fetch("/api/admin/backup", { credentials: "same-origin", headers: clubHeaders() });
  } catch {
    throw new ApiError("No se ha podido conectar con el servidor", 0);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(typeof data?.detail === "string" ? data.detail : "No se ha podido hacer la copia", response.status);
  }
  const name = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "copia-club.json";
  return { blob: await response.blob(), name };
}
export const listPendingUsers = () => request("/users/pending");
export const reviewAccess = (id, decision) => request(`/users/${id}/access`, { method: "POST", body: decision });
export const updateUser = (id, changes) => request(`/users/${id}`, { method: "PATCH", body: changes });
export const getAttendance = (teamId, date) =>
  request(`/attendance?team_id=${encodeURIComponent(teamId)}&date=${encodeURIComponent(date)}`);
export const answerAttendance = (teamId, date, status) =>
  request("/attendance", { method: "PUT", body: { team_id: teamId, date, status } });
export const getTrainingStars = (teamId) => request(`/attendance/stars?team_id=${encodeURIComponent(teamId)}`);
export const saveTrainingStars = (teamId, date, userIds) =>
  request("/attendance/stars", { method: "PUT", body: { team_id: teamId, date, user_ids: userIds } });
export const askForHelp = (teamId, date) => request("/attendance/help", { method: "POST", body: { team_id: teamId, date } });
export const joinHelp = (id) => request(`/attendance/help/${encodeURIComponent(id)}/join`, { method: "POST" });
export const leaveHelp = (id) => request(`/attendance/help/${encodeURIComponent(id)}/join`, { method: "DELETE" });
export const listChatChannels = () => request("/chat/channels");
export const listChatMessages = (channelId, before) =>
  request(`/chat/channels/${encodeURIComponent(channelId)}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`);
export const sendChatMessage = (channelId, text) =>
  request(`/chat/channels/${encodeURIComponent(channelId)}/messages`, { method: "POST", body: { text } });
export const markChatRead = (channelId) => request(`/chat/channels/${encodeURIComponent(channelId)}/read`, { method: "POST" });
export const startChatTyping = (channelId) => request(`/chat/channels/${encodeURIComponent(channelId)}/typing`, { method: "POST" });
export const stopChatTyping = (channelId) => request(`/chat/channels/${encodeURIComponent(channelId)}/typing`, { method: "DELETE" });
// Foto para el chat (ya reducida en el móvil), con un texto opcional al pie.
export async function sendChatImage(channelId, { blob, width, height }, text = "") {
  const params = new URLSearchParams({ width: String(width), height: String(height) });
  if (text) params.set("text", text);
  let response;
  try {
    response = await fetch(`/api/chat/channels/${encodeURIComponent(channelId)}/images?${params}`, {
      method: "POST",
      credentials: "same-origin",
      headers: clubHeaders({ "Content-Type": blob.type }),
      body: blob,
    });
  } catch {
    throw new ApiError("No se ha podido conectar con el servidor", 0);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(typeof data?.detail === "string" ? data.detail : "No se ha podido enviar la foto", response.status);
  return data;
}
export const deleteChatMessage =(id) => request(`/chat/messages/${encodeURIComponent(id)}`, { method: "DELETE" });
export const listMatches = (teamId) => request(`/matches?team_id=${encodeURIComponent(teamId)}`);
export const listPlayedMatches = (teamId) => request(`/matches/played?team_id=${encodeURIComponent(teamId)}`);
export const createMatch = (match) => request("/matches", { method: "POST", body: match });
export const updateMatch = (id, changes) => request(`/matches/${encodeURIComponent(id)}`, { method: "PATCH", body: changes });
export const deleteMatch = (id) => request(`/matches/${encodeURIComponent(id)}`, { method: "DELETE" });
export const answerMatch = (id, status) => request(`/matches/${encodeURIComponent(id)}/answer`, { method: "PUT", body: { status } });
export const getCalendar = (month) => request(`/calendar?month=${encodeURIComponent(month)}`);
export const createEvent = (event) => request("/events", { method: "POST", body: event });
export const updateEvent = (id, event) => request(`/events/${encodeURIComponent(id)}`, { method: "PUT", body: event });
export const deleteEvent = (id) => request(`/events/${encodeURIComponent(id)}`, { method: "DELETE" });
export const listRankingGroups = () => request("/ranking/groups");
export const getRanking = (groupId) => request(`/ranking?group_id=${encodeURIComponent(groupId)}`);
export const getPlayerRatings = (playerId, groupId) =>
  request(`/ranking/players/${encodeURIComponent(playerId)}?group_id=${encodeURIComponent(groupId)}`);
export const getRatingSheet = (groupId, week) =>
  request(`/ranking/sheet?group_id=${encodeURIComponent(groupId)}&week=${encodeURIComponent(week)}`);
export const saveRating = (rating) => request("/ranking/ratings", { method: "PUT", body: rating });
export const publishRatingWeek = (groupId, week) =>
  request("/ranking/publish", { method: "POST", body: { group_id: groupId, week } });
export const getNotificationStatus = () => request("/notifications/status");
export const updateNotificationPreferences = (changes) => request("/notifications/preferences", { method: "PUT", body: changes });
export const savePushSubscription = (subscription) => request("/notifications/subscription", { method: "PUT", body: subscription });
export const removePushSubscription = (endpoint) => request("/notifications/subscription/remove", { method: "POST", body: { endpoint } });
export const listBoards = (teamId) => request(`/boards?team_id=${encodeURIComponent(teamId)}`);
export const getBoard = (id) => request(`/boards/${encodeURIComponent(id)}`);
export const createBoard = (board) => request("/boards", { method: "POST", body: board });
export const updateBoard = (id, board) => request(`/boards/${encodeURIComponent(id)}`, { method: "PUT", body: board });
export const deleteBoard = (id) => request(`/boards/${encodeURIComponent(id)}`, { method: "DELETE" });
export const listTeams = () => request("/teams");
export const getSchedules = () => request("/schedules");
export const saveSchedule = (teamId, sessions) =>
  request(`/schedules/${encodeURIComponent(teamId)}`, { method: "PUT", body: { sessions } });
export const listTeamFamily = (teamId) => request(`/teams/${encodeURIComponent(teamId)}/family`);
export const listPlayers = (teamId) => request(`/players?team_id=${encodeURIComponent(teamId)}`);
// Partido en directo: marcador punto a punto y aciertos y fallos.
export const listLive = (teamId) => request(teamId ? `/live?team_id=${encodeURIComponent(teamId)}` : "/live");
export const getLive = (id) => request(`/live/${encodeURIComponent(id)}`);
export const enterLiveMatch = (matchId) => request(`/live/match/${encodeURIComponent(matchId)}`, { method: "POST" });
export const addLiveEvent = (id, body) => request(`/live/${encodeURIComponent(id)}/events`, { method: "POST", body });
export const undoLiveEvent = (id) => request(`/live/${encodeURIComponent(id)}/events/last`, { method: "DELETE" });
export const finishLive = (id, mvpPlayerId = null) =>
  request(`/live/${encodeURIComponent(id)}/finish`, { method: "POST", body: { mvp_player_id: mvpPlayerId } });
export const deleteLive = (id) => request(`/live/${encodeURIComponent(id)}`, { method: "DELETE" });
export const createPlayer = (player) => request("/players", { method: "POST", body: player });
export const updatePlayer = (id, changes) => request(`/players/${id}`, { method: "PATCH", body: changes });
export const deletePlayer = (id) => request(`/players/${id}`, { method: "DELETE" });
export const listBoardLineups = (teamId) => request(`/board-lineups?team_id=${encodeURIComponent(teamId)}`);
export const createBoardLineup = (lineup) => request("/board-lineups", { method: "POST", body: lineup });
export const deleteBoardLineup = (id) => request(`/board-lineups/${encodeURIComponent(id)}`, { method: "DELETE" });
export const renameBoardLineup = (id, name) => request(`/board-lineups/${encodeURIComponent(id)}`, { method: "PATCH", body: { name } });
