import { ButtonBase, Typography } from "@mui/material";

export function LandingButton({
  onClick,
  label = "TAP TO BEGIN",
  disabled = false,
}: {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      sx={{
        width: 280,
        height: 280,
        borderRadius: "50%",
        bgcolor: "grey.200",
        transition: "all 200ms",
        "&:hover": { bgcolor: "grey.300" },
        "&:active": { transform: "scale(0.98)" },
        "&.Mui-disabled": { opacity: 0.6 },
      }}
    >
      <Typography
        variant="h5"
        sx={{
          fontWeight: 300,
          letterSpacing: 2,
          color: "text.primary",
        }}
      >
        {label}
      </Typography>
    </ButtonBase>
  );
}
