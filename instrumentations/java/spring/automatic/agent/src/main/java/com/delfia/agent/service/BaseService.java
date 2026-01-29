package com.delfia.agent.service;

import java.util.List;

import com.delfia.agent.entity.BaseEntity;
import com.delfia.agent.repository.BaseRepository;

import jakarta.persistence.EntityNotFoundException;

public abstract class BaseService<T extends BaseEntity> {

    protected abstract BaseRepository<T> getRepository();

    protected abstract String getEntityName();

    public List<T> findAll() {
        return getRepository().findAll();
    }

    public T findById(Long id) {
        return getRepository().findById(id)
                .orElseThrow(() -> new EntityNotFoundException(
                        getEntityName() + " not found with id: " + id));
    }

    public T create(T entity) {
        return getRepository().save(entity);
    }

    public T update(Long id, T entity) {
        if (!getRepository().existsById(id)) {
            throw new EntityNotFoundException(
                    getEntityName() + " not found with id: " + id);
        }
        entity.setId(id);
        return getRepository().save(entity);
    }

    public void delete(Long id) {
        if (!getRepository().existsById(id)) {
            throw new EntityNotFoundException(
                    getEntityName() + " not found with id: " + id);
        }
        getRepository().deleteById(id);
    }
}
