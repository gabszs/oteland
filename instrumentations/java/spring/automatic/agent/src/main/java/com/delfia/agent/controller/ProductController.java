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
import com.delfia.agent.telemetry.WideEvent;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/v1/products")
public class ProductController {

    private static final Logger log = LoggerFactory.getLogger(ProductController.class);
    private static final String CONTROLLER_KEY = "product_controller";

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    private WideEvent getEvent(HttpServletRequest request) {
        return (WideEvent) request.getAttribute(WideEvent.REQUEST_ATTRIBUTE_KEY);
    }

    @GetMapping
    public ResponseEntity<List<ProductResponse>> findAll(HttpServletRequest request) {
        log.info("Listing all products");
        WideEvent event = getEvent(request);

        if (event != null) {
            event.addToJson(CONTROLLER_KEY, "name", "ProductController");
            event.addToJson(CONTROLLER_KEY, "method", "findAll");
        }

        List<ProductResponse> products = productService.findAll(event)
                .stream()
                .map(ProductMapper::toResponse)
                .toList();

        if (event != null) {
            event.addToJson(CONTROLLER_KEY, "result_count", products.size());
        }

        return ResponseEntity.ok(products);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductResponse> findById(
            @PathVariable Long id,
            HttpServletRequest request) {
        log.info("Finding product by id={}", id);
        WideEvent event = getEvent(request);

        if (event != null) {
            event.addToJson(CONTROLLER_KEY, "name", "ProductController");
            event.addToJson(CONTROLLER_KEY, "method", "findById");
            event.addToJson(CONTROLLER_KEY, "path_param_id", id);
        }

        Product product = productService.findById(id, event);

        if (event != null) {
            event.addToJson("product", "id", product.getId());
            event.addToJson("product", "name", product.getName());
            event.addToJson("product", "sku", product.getSku());
            event.addToJson("product", "price", product.getPrice().doubleValue());
        }

        return ResponseEntity.ok(ProductMapper.toResponse(product));
    }

    @PostMapping
    public ResponseEntity<ProductResponse> create(
            @Valid @RequestBody ProductRequest request,
            HttpServletRequest httpRequest) {
        log.info("Creating product name={} sku={}", request.getName(), request.getSku());
        WideEvent event = getEvent(httpRequest);

        if (event != null) {
            event.addToJson(CONTROLLER_KEY, "name", "ProductController");
            event.addToJson(CONTROLLER_KEY, "method", "create");
            event.addToJson("product_input", "name", request.getName());
            event.addToJson("product_input", "sku", request.getSku());
            event.addToJson("product_input", "price", request.getPrice().doubleValue());
            event.addToJson("product_input", "quantity", request.getQuantity());
        }

        Product product = ProductMapper.toEntity(request);
        Product saved = productService.create(product, event);

        if (event != null) {
            event.addToJson("product", "id", saved.getId());
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(ProductMapper.toResponse(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProductResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody ProductRequest request,
            HttpServletRequest httpRequest) {
        log.info("Updating product id={}", id);
        WideEvent event = getEvent(httpRequest);

        if (event != null) {
            event.addToJson(CONTROLLER_KEY, "name", "ProductController");
            event.addToJson(CONTROLLER_KEY, "method", "update");
            event.addToJson(CONTROLLER_KEY, "path_param_id", id);
            event.addToJson("product_input", "name", request.getName());
            event.addToJson("product_input", "sku", request.getSku());
        }

        Product existing = productService.findById(id, event);
        ProductMapper.updateEntity(existing, request);
        Product updated = productService.update(id, existing, event);

        return ResponseEntity.ok(ProductMapper.toResponse(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            HttpServletRequest request) {
        log.info("Deleting product id={}", id);
        WideEvent event = getEvent(request);

        if (event != null) {
            event.addToJson(CONTROLLER_KEY, "name", "ProductController");
            event.addToJson(CONTROLLER_KEY, "method", "delete");
            event.addToJson(CONTROLLER_KEY, "path_param_id", id);
        }

        productService.delete(id, event);

        return ResponseEntity.noContent().build();
    }
}
