package com.secureai.docshield.repository;

import com.secureai.docshield.domain.DocumentResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DocumentResultRepository extends JpaRepository<DocumentResult, String> {
}
