package com.delfia.agent.service;

import org.springframework.stereotype.Service;

import com.delfia.agent.entity.Product;
import com.delfia.agent.repository.BaseRepository;
import com.delfia.agent.repository.ProductRepository;

@Service
public class ProductService extends BaseService<Product> {

    private final ProductRepository productRepository;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @Override
    protected BaseRepository<Product> getRepository() {
        return productRepository;
    }

    @Override
    protected String getEntityName() {
        return "Product";
    }
}
