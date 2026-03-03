interface PlantLabelNameProps {
  name: string;
  variant?: string | null;
}

export function PlantLabelName({ name, variant }: PlantLabelNameProps) {
  return (
    <div className="label-name" title={variant ? `${name} (${variant})` : name}>
      {name}
      {variant ? ` (${variant})` : ''}
    </div>
  );
}
