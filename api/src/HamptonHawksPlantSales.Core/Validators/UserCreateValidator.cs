using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Core.Validators;

public class UserCreateValidator : AbstractValidator<CreateUserRequest>
{
    public UserCreateValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("Username is required.")
            .MaximumLength(100).WithMessage("Username must not exceed 100 characters.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required.")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters.");

        RuleFor(x => x.Roles)
            .NotNull().WithMessage("At least one role is required.")
            .Must(r => r.Any()).WithMessage("At least one role is required.");
    }
}
