using System.Text.Json.Serialization;

namespace HamptonHawksPlantSales.Core.DTOs;

public class ApiResponse<T>
{
    public bool Success { get; set; }
    [JsonIgnore(Condition = JsonIgnoreCondition.Never)]
    public T? Data { get; set; }
    public List<string> Errors { get; set; } = new();

    public static ApiResponse<T> Ok(T data) => new() { Success = true, Data = data };

    public static ApiResponse<T> Fail(string error) => new() { Success = false, Errors = new List<string> { error } };

    public static ApiResponse<T> Fail(List<string> errors) => new() { Success = false, Errors = errors };
}
