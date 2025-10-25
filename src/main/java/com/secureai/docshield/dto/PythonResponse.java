package com.secureai.docshield.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.secureai.docshield.domain.DocumentType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PythonResponse {
    private String markdown;
    private DocumentType documentType;
}
