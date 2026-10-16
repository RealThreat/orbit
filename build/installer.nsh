!macro customUnInstall
  ${ifNot} ${isUpdated}
    RMDir /r "$LOCALAPPDATA\orbit-launcher-updater"
  ${endIf}
!macroend
