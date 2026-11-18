; Installateur de Maxou's Nav
Unicode true
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!define APPNAME "Maxou's Nav"
!define EXE "MaxousNav.exe"
!ifndef VERSION
  !define VERSION "1.0.0"
!endif
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\MaxousNav"

!include "MUI2.nsh"
!include "FileFunc.nsh"

Name "${APPNAME}"
OutFile "..\dist\Maxous-Nav-Installation-${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\Maxous Nav"
InstallDirRegKey HKCU "Software\MaxousNav" "InstallDir"
RequestExecutionLevel user
BrandingText "${APPNAME} ${VERSION}"
ShowInstDetails nevershow
ShowUninstDetails nevershow

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "FileDescription" "Installation de ${APPNAME}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "CompanyName" "Maxou"
VIAddVersionKey "LegalCopyright" "© 2026 Maxou"

!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "sidebar.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "sidebar.bmp"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Bienvenue dans l'installation de ${APPNAME}"
!define MUI_WELCOMEPAGE_TEXT "Ton navigateur rapide, beau et sans pubs.$\r$\n$\r$\nClique sur Suivant pour continuer."
!define MUI_FINISHPAGE_TITLE "${APPNAME} est installé !"
!define MUI_FINISHPAGE_TEXT "Un raccourci a été ajouté sur ton Bureau et dans le menu Démarrer."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Lancer ${APPNAME} maintenant"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "French"

Section "Install"
  ; Ferme Maxou's Nav s'il est ouvert (mise à jour)
  ExecWait 'cmd /c taskkill /F /IM "${EXE}" >nul 2>&1'
  Sleep 400

  SetOutPath "$INSTDIR"
  RMDir /r "$INSTDIR\resources"
  File /r "..\dist\win-unpacked\*.*"

  WriteUninstaller "$INSTDIR\Desinstaller.exe"

  CreateShortcut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0
  CreateShortcut "$SMPROGRAMS\${APPNAME}.lnk" "$INSTDIR\${EXE}" "" "$INSTDIR\${EXE}" 0

  WriteRegStr HKCU "Software\MaxousNav" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${EXE},0"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "Maxou"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Desinstaller.exe"'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" "$0"
SectionEnd

; Après une mise à jour automatique (silencieuse), relance le navigateur
Function .onInstSuccess
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "--updated" $R1
  IfErrors done
  Exec '"$INSTDIR\${EXE}"'
  done:
FunctionEnd

Section "Uninstall"
  ExecWait 'cmd /c taskkill /F /IM "${EXE}" >nul 2>&1'
  Sleep 400
  Delete "$DESKTOP\${APPNAME}.lnk"
  Delete "$SMPROGRAMS\${APPNAME}.lnk"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "Software\MaxousNav"
SectionEnd
