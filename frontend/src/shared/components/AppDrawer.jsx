import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Box, Drawer, IconButton, Stack, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";

import { designTokens } from "../../theme";

export default function AppDrawer({ open, onClose, title, subtitle, fullScreenOnMobile = false, actions = null, children }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const anchor = isMobile ? "bottom" : "right";

  return (
    <Drawer
      anchor={anchor}
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: designTokens.drawer.desktopWidth },
          maxWidth: "100%",
          height: { xs: fullScreenOnMobile ? "100%" : designTokens.drawer.mobilePeekHeight, sm: "100%" },
          borderTopLeftRadius: { xs: fullScreenOnMobile ? 0 : `${designTokens.drawer.mobileBorderRadius}px`, sm: 0 },
          borderTopRightRadius: { xs: fullScreenOnMobile ? 0 : `${designTokens.drawer.mobileBorderRadius}px`, sm: 0 },
          bgcolor: designTokens.app.surface,
        },
      }}
    >
      <Stack sx={{ height: "100%", minHeight: 0 }}>
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          spacing={`${designTokens.spacing.md}px`}
          sx={{
            position: "sticky",
            top: 0,
            zIndex: designTokens.zIndex.stickyHeader,
            p: `${designTokens.spacing.lg}px`,
            bgcolor: designTokens.app.surface,
            borderBottom: `${designTokens.card.borderWidth}px solid ${designTokens.colors.border}`,
          }}
        >
          <Stack spacing={`${designTokens.spacing.xs}px`}>
            <Typography variant="h2">{title}</Typography>
            {subtitle ? <Typography color="text.secondary">{subtitle}</Typography> : null}
          </Stack>
          <IconButton aria-label="Fermer" onClick={onClose}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>

        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: `${designTokens.spacing.lg}px` }}>
          {children}
        </Box>

        {actions ? (
          <Stack
            direction="row"
            spacing={`${designTokens.spacing.sm}px`}
            justifyContent="flex-end"
            sx={{
              position: "sticky",
              bottom: 0,
              zIndex: designTokens.zIndex.bottomActionBar,
              minHeight: designTokens.drawer.bottomActionHeight,
              p: `${designTokens.spacing.md}px`,
              bgcolor: designTokens.app.surface,
              borderTop: `${designTokens.card.borderWidth}px solid ${designTokens.colors.border}`,
            }}
          >
            {actions}
          </Stack>
        ) : null}
      </Stack>
    </Drawer>
  );
}
