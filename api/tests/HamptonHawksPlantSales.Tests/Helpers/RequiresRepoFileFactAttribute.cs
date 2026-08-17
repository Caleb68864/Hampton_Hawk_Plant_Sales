namespace HamptonHawksPlantSales.Tests.Helpers;

/// <summary>
/// A <see cref="FactAttribute"/> that skips itself when a fixture file cannot be found by
/// walking up from the test output directory. Used for fixtures that are deliberately not
/// committed (e.g. gitignored PDFs containing real customer data) but exist on developer
/// machines that have them locally.
/// </summary>
public sealed class RequiresRepoFileFactAttribute : FactAttribute
{
    public RequiresRepoFileFactAttribute(string fileName)
    {
        if (!Exists(fileName))
        {
            Skip = $"Fixture '{fileName}' not found (it is not committed to the repo).";
        }
    }

    private static bool Exists(string fileName)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            if (File.Exists(Path.Combine(dir.FullName, fileName)))
            {
                return true;
            }

            dir = dir.Parent;
        }

        return false;
    }
}
