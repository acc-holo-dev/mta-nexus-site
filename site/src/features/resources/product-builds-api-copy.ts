import type { Locale } from "../../lib/i18n";

const en = {
  authenticationRequired: "Authentication required",
  actorRequired: "Actor precondition required",
  actorChanged: "Actor changed",
  rate: "Build upload limit exceeded",
  archiveTooLarge: (mb: number) => `Build archive exceeds the ${mb}MB free-beta limit`,
  multipartRequired: "Build upload requires multipart/form-data",
  multipartInvalid: "Invalid multipart build upload",
  metadataInvalid: "A valid build archive and semantic version are required",
  fileTypeNotAllowed: "Only .zip, .rar, .7z, and .lua resource builds are allowed",
  fileNameInvalid: "A valid build file name is required",
  contentMismatch: "Build content does not match its file extension",
  malwareDetected: "Build was rejected by the malware scanner",
  scanLimitExceeded:
    "The build exceeds malware scanner limits and could not be fully checked. Reduce its size or archive complexity and try again.",
  scannerUnavailable:
    "Malware scanning is temporarily unavailable. No build was stored; retry the upload later.",
  publishFailed: "Could not publish build",
};

const ru = {
  authenticationRequired: "Требуется вход",
  actorRequired: "Требуется предусловие актора",
  actorChanged: "Актор изменился",
  rate: "Превышен лимит загрузки сборок",
  archiveTooLarge: (mb: number) => `Архив сборки превышает лимит free-beta ${mb} МБ`,
  multipartRequired: "Загрузка сборки требует multipart/form-data",
  multipartInvalid: "Некорректная multipart-загрузка сборки",
  metadataInvalid: "Нужны корректный архив сборки и семантическая версия",
  fileTypeNotAllowed: "Допускаются только сборки ресурсов .zip, .rar, .7z и .lua",
  fileNameInvalid: "Требуется корректное имя файла сборки",
  contentMismatch: "Содержимое сборки не соответствует расширению файла",
  malwareDetected: "Сборка отклонена антивирусным сканером",
  scanLimitExceeded:
    "Сборка превышает лимиты антивирусного сканера и не может быть полностью проверена. Уменьшите размер или сложность архива и попробуйте снова.",
  scannerUnavailable:
    "Антивирусное сканирование временно недоступно. Сборка не сохранена; повторите загрузку позже.",
  publishFailed: "Не удалось опубликовать сборку",
};

export const productBuildsApiCopy = (locale: Locale) => (locale === "ru" ? ru : en);
