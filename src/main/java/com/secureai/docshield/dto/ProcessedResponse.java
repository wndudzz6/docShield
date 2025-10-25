package com.secureai.docshield.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Gemini에서 받은 AI 응답(JSON 문자열)을 감싸는 DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProcessedResponse {
    private String processed; // Python 서버에서 받은 "processed" 결과(JSON 문자열)
}
