package com.secureai.docshield.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "document_results")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentResult {

    @Id
    private String id;

    @Enumerated(EnumType.STRING)
    private DocumentType type;

    @Column(columnDefinition = "CLOB")
    private String pythonMarkdown;

    @Column(columnDefinition = "CLOB")
    private String geminiMarkdown;

    private String fileName;
}
