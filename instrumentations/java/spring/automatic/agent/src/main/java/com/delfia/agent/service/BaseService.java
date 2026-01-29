package com.delfia.agent.service;

import java.util.List;

import com.delfia.agent.entity.BaseEntity;
import com.delfia.agent.repository.BaseRepository;
import com.delfia.agent.telemetry.WideEvent;

import jakarta.persistence.EntityNotFoundException;

public abstract class BaseService<T extends BaseEntity> {

    protected abstract BaseRepository<T> getRepository();

    protected abstract String getEntityName();

    protected String getServiceKey() {
        return getEntityName().toLowerCase() + "_service";
    }

    public List<T> findAll(WideEvent event) {
        long start = System.currentTimeMillis();
        try {
            List<T> result = getRepository().findAll();
            if (event != null) {
                event.addToJson(getServiceKey(), "operation", "findAll");
                event.addToJson(getServiceKey(), "entity", getEntityName());
                event.addToJson(getServiceKey(), "result_count", result.size());
            }
            return result;
        } finally {
            long duration = System.currentTimeMillis() - start;
            if (event != null) {
                event.addToJson(getServiceKey(), "duration_ms", duration);
                event.recordDbQuery(duration);
            }
        }
    }

    public T findById(Long id, WideEvent event) {
        long start = System.currentTimeMillis();
        try {
            T result = getRepository().findById(id)
                    .orElseThrow(() -> new EntityNotFoundException(
                            getEntityName() + " not found with id: " + id));
            if (event != null) {
                event.addToJson(getServiceKey(), "operation", "findById");
                event.addToJson(getServiceKey(), "entity", getEntityName());
                event.addToJson(getServiceKey(), "entity_id", id);
                event.addToJson(getServiceKey(), "found", true);
            }
            return result;
        } catch (EntityNotFoundException e) {
            if (event != null) {
                event.addToJson(getServiceKey(), "found", false);
            }
            throw e;
        } finally {
            long duration = System.currentTimeMillis() - start;
            if (event != null) {
                event.addToJson(getServiceKey(), "duration_ms", duration);
                event.recordDbQuery(duration);
            }
        }
    }

    public T create(T entity, WideEvent event) {
        long start = System.currentTimeMillis();
        try {
            T result = getRepository().save(entity);
            if (event != null) {
                event.addToJson(getServiceKey(), "operation", "create");
                event.addToJson(getServiceKey(), "entity", getEntityName());
                event.addToJson(getServiceKey(), "entity_id", result.getId());
            }
            return result;
        } finally {
            long duration = System.currentTimeMillis() - start;
            if (event != null) {
                event.addToJson(getServiceKey(), "duration_ms", duration);
                event.recordDbQuery(duration);
            }
        }
    }

    public T update(Long id, T entity, WideEvent event) {
        long start = System.currentTimeMillis();
        try {
            if (!getRepository().existsById(id)) {
                if (event != null) {
                    event.addToJson(getServiceKey(), "found", false);
                }
                throw new EntityNotFoundException(
                        getEntityName() + " not found with id: " + id);
            }
            entity.setId(id);
            T result = getRepository().save(entity);
            if (event != null) {
                event.addToJson(getServiceKey(), "operation", "update");
                event.addToJson(getServiceKey(), "entity", getEntityName());
                event.addToJson(getServiceKey(), "entity_id", id);
                event.addToJson(getServiceKey(), "found", true);
            }
            return result;
        } finally {
            long duration = System.currentTimeMillis() - start;
            if (event != null) {
                event.addToJson(getServiceKey(), "duration_ms", duration);
                event.recordDbQuery(duration);
            }
        }
    }

    public void delete(Long id, WideEvent event) {
        long start = System.currentTimeMillis();
        try {
            if (!getRepository().existsById(id)) {
                if (event != null) {
                    event.addToJson(getServiceKey(), "found", false);
                }
                throw new EntityNotFoundException(
                        getEntityName() + " not found with id: " + id);
            }
            getRepository().deleteById(id);
            if (event != null) {
                event.addToJson(getServiceKey(), "operation", "delete");
                event.addToJson(getServiceKey(), "entity", getEntityName());
                event.addToJson(getServiceKey(), "entity_id", id);
                event.addToJson(getServiceKey(), "found", true);
            }
        } finally {
            long duration = System.currentTimeMillis() - start;
            if (event != null) {
                event.addToJson(getServiceKey(), "duration_ms", duration);
                event.recordDbQuery(duration);
            }
        }
    }

    // Backward compatibility - methods without WideEvent
    public List<T> findAll() {
        return findAll(null);
    }

    public T findById(Long id) {
        return findById(id, null);
    }

    public T create(T entity) {
        return create(entity, null);
    }

    public T update(Long id, T entity) {
        return update(id, entity, null);
    }

    public void delete(Long id) {
        delete(id, null);
    }
}
