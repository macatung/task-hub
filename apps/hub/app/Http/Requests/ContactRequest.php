<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ContactRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Allowed project types list.
     *
     * @var list<string>
     */
    public const ALLOWED_PROJECT_TYPES = [
        'Full-Stack Web App',
        'Creative UI/UX & Web Audio',
        'High-Throughput Microservice',
        'AI Agents & Automation',
        'Tech Lead / Architecture Consulting',
        'Other Quest',
    ];

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'project_type' => ['required', 'string', Rule::in(self::ALLOWED_PROJECT_TYPES)],
            'coffee_offering' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'min:10', 'max:5000'],
        ];
    }

    /**
     * Get custom error messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'The name field is required.',
            'name.max' => 'The name field must not exceed 255 characters.',
            'email.required' => 'The email field is required.',
            'email.email' => 'The email field must be a valid email address.',
            'email.max' => 'The email field must not exceed 255 characters.',
            'project_type.required' => 'The project type field is required.',
            'project_type.in' => 'The selected project type is invalid.',
            'coffee_offering.required' => 'The coffee offering field is required.',
            'coffee_offering.max' => 'The coffee offering must not exceed 255 characters.',
            'message.required' => 'The message field is required.',
            'message.min' => 'The message must be at least 10 characters.',
            'message.max' => 'The message may not be greater than 5000 characters.',
        ];
    }

    /**
     * Prepare data for validation (trim whitespace on string inputs).
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => is_string($this->name) ? trim($this->name) : $this->name,
            'email' => is_string($this->email) ? trim($this->email) : $this->email,
            'project_type' => is_string($this->project_type) ? trim($this->project_type) : $this->project_type,
            'coffee_offering' => is_string($this->coffee_offering) ? trim($this->coffee_offering) : $this->coffee_offering,
            'message' => is_string($this->message) ? trim($this->message) : $this->message,
        ]);
    }
}
