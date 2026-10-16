import {
  AppsIcon,
  DownloadIcon,
  GearIcon,
  HomeIcon,
  BookIcon,
  TrophyIcon,
} from "@primer/octicons-react";

export const routes = [
  {
    path: "/",
    nameKey: "home",
    render: () => <HomeIcon />,
  },
  {
    path: "/catalogue",
    nameKey: "catalogue",
    render: () => <AppsIcon />,
  },
  {
    path: "/library",
    nameKey: "library",
    render: () => <BookIcon />,
  },
  {
    path: "/downloads",
    nameKey: "downloads",
    render: () => <DownloadIcon />,
  },
  {
    path: "/console-achievements",
    nameKey: "console_achievements",
    render: () => <TrophyIcon />,
  },
  {
    path: "/settings",
    nameKey: "settings",
    render: () => <GearIcon />,
  },
];
