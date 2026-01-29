package com.delfia.agent.controller;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.delfia.agent.dto.ProductMapper;
import com.delfia.agent.dto.ProductRequest;
import com.delfia.agent.dto.ProductResponse;
import com.delfia.agent.entity.Product;
import com.delfia.agent.service.ProductService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/v1/products")
public class ProductController {

    private static final Logger log = LoggerFactory.getLogger(ProductController.class);

    private final ProductService productService;

    public ProductController(ProductService productService) { 
        this.productService = productService;
    }

    @GetMapping
    public ResponseEntity<List<ProductResponse>> findAll() {
        log.info("Listing all products");
        List<ProductResponse> products = productService.findAll()
                .stream()
                .map(ProductMapper::toResponse)
                .toList();
        return ResponseEntity.ok(products);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductResponse> findById(@PathVariable Long id) {
        log.info("Finding product by id={}", id);
        Product product = productService.findById(id);
        return ResponseEntity.ok(ProductMapper.toResponse(product));
    }

    @PostMapping
    public ResponseEntity<ProductResponse> create(@Valid @RequestBody ProductRequest request) {
        log.info("Creating product name={} sku={}", request.getName(), request.getSku());
        Product product = ProductMapper.toEntity(request);
        Product saved = productService.create(product);
        return ResponseEntity.status(HttpStatus.CREATED).body(ProductMapper.toResponse(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProductResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody ProductRequest request) {
        log.info("Updating product id={}", id);
        Product existing = productService.findById(id);
        ProductMapper.updateEntity(existing, request);
        Product updated = productService.update(id, existing);
        return ResponseEntity.ok(ProductMapper.toResponse(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        log.info("Deleting product id={}", id);
        productService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
